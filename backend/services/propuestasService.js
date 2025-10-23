// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- Función getAvailabilityData (Sin cambios recientes, incluir completa) ---
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta'])
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                const capacidadReducida = prop.capacidad - (prop.camas.camarotes * 2);
                return { ...prop, capacidad: Math.max(0, capacidadReducida) };
            }
            return prop;
        });
    }

    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        let fechaInicio, fechaTermino;
         try {
            fechaInicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
            fechaTermino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
            if (!isValid(fechaInicio) || !isValid(fechaTermino)) throw new Error('Fecha inválida');
         } catch(e) {
              console.warn(`[WARN] Tarifa ${doc.id} tiene fechas inválidas, será ignorada.`, data.fechaInicio, data.fechaTermino);
              return null;
         }
        return { ...data, id: doc.id, fechaInicio, fechaTermino };
    }).filter(Boolean);

    const propiedadesConTarifa = allProperties.filter(prop => {
        return allTarifas.some(tarifa => {
            return tarifa.alojamientoId === prop.id && tarifa.fechaInicio <= endDate && tarifa.fechaTermino >= startDate;
        });
    });

    const overlappingReservations = [];
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
        if (fechaSalidaReserva && isValid(fechaSalidaReserva) && fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        } else if (!fechaSalidaReserva || !isValid(fechaSalidaReserva)) {
             console.warn(`[WARN] Reserva ${doc.id} tiene fechaSalida inválida y será ignorada en cálculo de disponibilidad.`);
        }
    });

    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            const start = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : (reserva.fechaLlegada ? parseISO(reserva.fechaLlegada + 'T00:00:00Z') : null);
            const end = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
            if (start && end && isValid(start) && isValid(end)) {
                availabilityMap.get(reserva.alojamientoId).push({ start, end });
            }
        }
    });

    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}


// --- Función findNormalCombination (Corregida anteriormente para grupos, se mantiene) ---
function findNormalCombination(availableProperties, requiredCapacity) {
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    // 1. Verificar si alguna propiedad individual cumple
    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            console.log(`[findNormalCombination] Encontrada solución individual: ${prop.id} (Cap: ${prop.capacidad}) para ${requiredCapacity} personas.`);
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    // 2. Si no, intentar combinar (enfoque greedy)
    console.log(`[findNormalCombination] No hay solución individual para ${requiredCapacity}. Intentando combinación greedy...`);
    let currentCombination = [];
    let currentCapacity = 0;

    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
            console.log(`[findNormalCombination] Añadida ${prop.id} (Cap: ${prop.capacidad}). Capacidad actual: ${currentCapacity}`);
        }
        // No usar break aquí, continuar iterando
    }

    // 3. Verificar si la combinación encontrada es válida *DESPUÉS* del bucle
    if (currentCapacity >= requiredCapacity) {
        console.log(`[findNormalCombination] Combinación final encontrada: ${currentCombination.map(p=>p.id).join(', ')} (Cap Total: ${currentCapacity})`);
        return { combination: currentCombination, capacity: currentCapacity };
    }

    // 4. Si no se encontró combinación válida
    console.log(`[findNormalCombination] No se encontró combinación válida para ${requiredCapacity} personas.`);
    return { combination: [], capacity: 0 };
}


// *** FUNCIÓN findSegmentedCombination RESTAURADA A SU VERSIÓN ORIGINAL ***
// (Esta es la versión que funcionaba con "Agregar Propuesta")
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    const dailyAvailableProperties = {}; // Almacenará { 'YYYY-MM-DD': [prop1, prop2...] }

    // 1. Determinar propiedades disponibles para CADA día del rango
    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        dailyAvailableProperties[dateStr] = allProperties.filter(prop => {
            // Verificar si tiene tarifa para este día
            const hasTarifa = allTarifas.some(t =>
                t.alojamientoId === prop.id && t.fechaInicio <= d && t.fechaTermino >= d
            );
            if (!hasTarifa) return false;

            // Verificar si está ocupada este día
            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                d >= res.start && d < res.end
            );
            return !isOccupied;
        });
    }

    // 2. Encontrar la mejor combinación posible día por día
    const bestDailyOptions = [];
    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const availableToday = dailyAvailableProperties[dateStr] || [];

        // Buscar primero una propiedad individual que cumpla
        let bestOption = availableToday
            .filter(p => p.capacidad >= requiredCapacity)
            .sort((a, b) => a.capacidad - b.capacidad)[0]; // La de menor capacidad que cumpla

        // Si no hay individual, intentar combinar (greedy)
        if (!bestOption) {
            const sortedAvailable = availableToday.sort((a, b) => b.capacidad - a.capacidad);
            let currentCombination = [];
            let currentCapacity = 0;
            for (const prop of sortedAvailable) {
                currentCombination.push(prop);
                currentCapacity += prop.capacidad;
                if (currentCapacity >= requiredCapacity) break; // Detener al cumplir
            }
            // Solo considerar válida la combinación si se alcanzó la capacidad
            if (currentCapacity >= requiredCapacity) {
                bestOption = currentCombination; // Ahora bestOption puede ser un array
            }
        }

        if (bestOption) {
            bestDailyOptions.push({
                date: new Date(d), // Guardar copia
                option: bestOption // Puede ser objeto (individual) o array (combinación)
            });
        } else {
            // Si algún día no tiene opción, la segmentación no es posible
            console.log(`[findSegmented] No se encontró opción para ${dateStr} con capacidad ${requiredCapacity}`);
            return { combination: [], capacity: 0, dailyOptions: [] }; // Devolver vacío si falla un día
        }
    }

    // Si llegamos aquí, se encontró una opción para cada día
    // La 'combination' en este caso es la lista de opciones diarias
    // La 'capacity' es la requerida, ya que garantizamos que se cumple cada día
    return { combination: bestDailyOptions, capacity: requiredCapacity, dailyOptions: bestDailyOptions };
}
// *** FIN FUNCIÓN RESTAURADA ***


// --- Función calculatePrice (Sin cambios recientes, incluir completa) ---
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {
    // ... (Código de calculatePrice como en la respuesta anterior) ...
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };

    const valorDolarDia = valorDolarDiaOverride ??
                          ((canalPorDefecto.moneda === 'USD' || canalObjetivo.moneda === 'USD')
                              ? await obtenerValorDolar(db, empresaId, startDate)
                              : null);

    let totalPrecioOriginal = 0; // Moneda del canal objetivo
    const priceDetails = [];
    let totalNights = 0;

    if (isSegmented) {
        // 'items' aquí es el array de bestDailyOptions [{ date: Date, option: Prop | Prop[] }, ...]
        totalNights = differenceInDays(endDate, startDate);
        if (totalNights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };

        for (const dailyOption of items) {
            const currentDate = dailyOption.date;
            const option = dailyOption.option; // Puede ser objeto o array
            const propertiesForDay = Array.isArray(option) ? option : [option];
            let dailyRateBase = 0; // Tarifa base SUMADA para todas las props de ESE día (moneda default)

            for (const prop of propertiesForDay) {
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );
                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    dailyRateBase += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
                } else {
                     console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')} (segmentado)`);
                }
            }

            // Aplicar modificador y conversión a la tarifa SUMADA del día
            let dailyRateModified = dailyRateBase;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    dailyRateModified *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    // El fijo se aplica por NOCHE, así que lo sumamos directo al rate diario
                    dailyRateModified += canalObjetivo.modificadorValor;
                }
            }

            let dailyRateInTargetCurrency = dailyRateModified;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                dailyRateInTargetCurrency = dailyRateModified * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                 dailyRateInTargetCurrency = valorDolarDia > 0 ? (dailyRateModified / valorDolarDia) : 0;
            }

            totalPrecioOriginal += dailyRateInTargetCurrency; // Sumar la tarifa diaria calculada al total

             // Detalles (opcional, podría simplificarse para segmentado)
             priceDetails.push({
                 date: format(currentDate, 'yyyy-MM-dd'),
                 properties: propertiesForDay.map(p => p.nombre).join(', '),
                 dailyRate: dailyRateInTargetCurrency
             });
        }

    } else { // Cálculo NO segmentado (grupo normal o individual)
        totalNights = differenceInDays(endDate, startDate);
        if (totalNights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };

        for (const prop of items) { // 'items' es el array de propiedades [prop1, prop2...]
            let propPrecioBaseTotal = 0; // Precio base total de UNA propiedad para TODO el rango

            for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
                const currentDate = new Date(d);
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );

                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    propPrecioBaseTotal += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
                } else {
                     console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')}`);
                }
            }

            let precioPropModificado = propPrecioBaseTotal; // En moneda default
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificado *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    precioPropModificado += (canalObjetivo.modificadorValor * totalNights);
                }
            }

            let precioPropEnMonedaObjetivo = precioPropModificado;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                 precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificado / valorDolarDia) : 0;
            }

            totalPrecioOriginal += precioPropEnMonedaObjetivo;

            priceDetails.push({
                nombre: prop.nombre,
                precioTotal: precioPropEnMonedaObjetivo,
                precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
            });
        }
    }

    let totalPriceCLP = totalPrecioOriginal;
    if (canalObjetivo.moneda === 'USD') {
         if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para calcular el total en CLP desde USD.");
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),
        totalPriceOriginal: totalPrecioOriginal,
        currencyOriginal: canalObjetivo.moneda,
        valorDolarDia: valorDolarDia,
        nights: totalNights,
        details: priceDetails
    };
}


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination, // Restaurada a la versión que espera agregarPropuesta.js
    calculatePrice
};