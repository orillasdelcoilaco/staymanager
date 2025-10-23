// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- Función getAvailabilityData (Sin cambios recientes) ---
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // ... (Código completo de getAvailabilityData como en respuestas anteriores) ...
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
         } catch(e) { return null; }
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

    // availableProperties son aquellas CON TARIFA y SIN reservas que se solapen en NINGÚN DÍA del rango
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        // Comprobar si *alguna* reserva existente choca con el rango [startDate, endDate)
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}


// --- Función findNormalCombination (Sin cambios recientes) ---
function findNormalCombination(availableProperties, requiredCapacity) {
    // ... (Código corregido de findNormalCombination como en la respuesta anterior) ...
     const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            console.log(`[findNormalCombination] Encontrada solución individual: ${prop.id} (Cap: ${prop.capacidad}) para ${requiredCapacity} personas.`);
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    console.log(`[findNormalCombination] No hay solución individual para ${requiredCapacity}. Intentando combinación greedy...`);
    let currentCombination = [];
    let currentCapacity = 0;

    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
            console.log(`[findNormalCombination] Añadida ${prop.id} (Cap: ${prop.capacidad}). Capacidad actual: ${currentCapacity}`);
        }
    }

    if (currentCapacity >= requiredCapacity) {
        console.log(`[findNormalCombination] Combinación final encontrada: ${currentCombination.map(p=>p.id).join(', ')} (Cap Total: ${currentCapacity})`);
        return { combination: currentCombination, capacity: currentCapacity };
    }

    console.log(`[findNormalCombination] No se encontró combinación válida para ${requiredCapacity} personas.`);
    return { combination: [], capacity: 0 };
}


// *** FUNCIÓN findSegmentedCombination RESTAURADA (Versión que funcionaba con agregarPropuesta) ***
// Intenta encontrar la mejor opción (individual o combinada) para CADA DÍA.
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    const dailyOptions = []; // Array de { date: Date, option: Prop | Prop[] }

    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const currentDate = new Date(d); // Usar copia

        // Propiedades disponibles ESE DÍA (con tarifa y sin ocupación)
        const dailyAvailable = allProperties.filter(prop => {
            const hasTarifa = allTarifas.some(t =>
                t.alojamientoId === prop.id && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
            );
            if (!hasTarifa) return false;

            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                currentDate >= res.start && currentDate < res.end
            );
            return !isOccupied;
        });

        if (dailyAvailable.length === 0) {
            console.log(`[findSegmented] No hay propiedades disponibles para ${format(currentDate, 'yyyy-MM-dd')}`);
            return { combination: [], capacity: 0, dailyOptions: [] }; // Falla si un día no hay nada disponible
        }

        // 1. Buscar la mejor opción INDIVIDUAL (menor capacidad >= requerida)
        let bestOption = dailyAvailable
            .filter(p => p.capacidad >= requiredCapacity)
            .sort((a, b) => a.capacidad - b.capacidad)[0];

        // 2. Si no hay individual, intentar COMBINAR (greedy)
        if (!bestOption) {
            const sortedAvailable = dailyAvailable.sort((a, b) => b.capacidad - a.capacidad);
            let currentCombination = [];
            let currentCapacity = 0;
            for (const prop of sortedAvailable) {
                currentCombination.push(prop);
                currentCapacity += prop.capacidad;
                if (currentCapacity >= requiredCapacity) break; // Detener al cumplir
            }
            // Solo es válida la combinación si se alcanzó la capacidad
            if (currentCapacity >= requiredCapacity) {
                bestOption = currentCombination; // bestOption es ahora un array
            }
        }

        // 3. Si se encontró opción (individual o combinada), guardarla
        if (bestOption) {
            dailyOptions.push({
                date: currentDate,
                option: bestOption // Puede ser objeto (individual) o array (combinación)
            });
        } else {
            // Si ni individual ni combinada funcionan para este día, la segmentación falla
            console.log(`[findSegmented] No se encontró opción (individual ni combinada) para ${format(currentDate, 'yyyy-MM-dd')} con capacidad ${requiredCapacity}`);
            return { combination: [], capacity: 0, dailyOptions: [] };
        }
    }

    // Si llegamos aquí, se encontró una opción para cada día
    console.log(`[findSegmented] Opciones diarias encontradas: ${dailyOptions.length}`);
    // 'combination' es la lista de opciones diarias. El frontend la procesará para armar el itinerario.
    return { combination: dailyOptions, capacity: requiredCapacity, dailyOptions: dailyOptions };
}
// *** FIN FUNCIÓN RESTAURADA ***


// --- Función calculatePrice (Sin cambios recientes) ---
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {
    // ... (Código completo de calculatePrice como en la respuesta anterior) ...
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
    let totalNights = differenceInDays(endDate, startDate);
    // Permitir 0 noches si es segmentado, ya que se calcula por día
    if (totalNights <= 0 && !isSegmented) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };


    if (isSegmented) {
        // items = dailyOptions = [{ date: Date, option: Prop | Prop[] }, ...]
        totalNights = 0; // Reiniciar y sumar por día/segmento encontrado
        for (const dailyOption of items) {
            const currentDate = dailyOption.date;
            const option = dailyOption.option; // Prop o Prop[]
            const propertiesForDay = Array.isArray(option) ? option : [option];
            totalNights++; // Cada item en dailyOptions representa una noche

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

            let dailyRateModified = dailyRateBase; // En moneda default
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    dailyRateModified *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    // El fijo se aplica por NOCHE, sumamos directo al rate diario
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

            totalPrecioOriginal += dailyRateInTargetCurrency;

             // Guardar detalle diario (útil para frontend)
             priceDetails.push({
                 date: format(currentDate, 'yyyy-MM-dd'),
                 properties: propertiesForDay.map(p => ({id: p.id, nombre: p.nombre})), // Guardar IDs y nombres
                 dailyRate: dailyRateInTargetCurrency // Rate diario en moneda objetivo
             });
        }

    } else { // Cálculo NO segmentado
        for (const prop of items) {
            let propPrecioBaseTotal = 0; // Moneda default
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

            let precioPropModificado = propPrecioBaseTotal; // Moneda default
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
                id: prop.id, // Añadir ID para referencia
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
        details: priceDetails // Importante para construir el itinerario en el frontend
    };
}


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination, // Restaurada a versión compatible con panel
    calculatePrice
};