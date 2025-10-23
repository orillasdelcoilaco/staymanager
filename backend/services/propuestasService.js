// backend/services/propuestasService.js

const admin = require('firebase-admin');
// *** VERIFICACIÓN CRÍTICA: Asegurarse que esta línea esté presente y correcta ***
const { obtenerValorDolar } = require('./dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- Función getAvailabilityData (Sin cambios) ---
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // ... (Código completo de getAvailabilityData) ...
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

    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}


// --- Función findNormalCombination (Sin cambios) ---
function findNormalCombination(availableProperties, requiredCapacity) {
    // ... (Código completo de findNormalCombination) ...
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


// --- Función findSegmentedCombination (Versión restaurada para SPA) ---
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    // ... (Código completo de findSegmentedCombination restaurado) ...
    const dailyOptions = []; // Array de { date: Date, option: Prop | Prop[] }

    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const currentDate = new Date(d); // Usar copia

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

        let bestOption = dailyAvailable
            .filter(p => p.capacidad >= requiredCapacity)
            .sort((a, b) => a.capacidad - b.capacidad)[0];

        if (!bestOption) {
            const sortedAvailable = dailyAvailable.sort((a, b) => b.capacidad - a.capacidad);
            let currentCombination = [];
            let currentCapacity = 0;
            for (const prop of sortedAvailable) {
                currentCombination.push(prop);
                currentCapacity += prop.capacidad;
                if (currentCapacity >= requiredCapacity) break;
            }
            if (currentCapacity >= requiredCapacity) {
                bestOption = currentCombination;
            }
        }

        if (bestOption) {
            dailyOptions.push({
                date: currentDate,
                option: bestOption
            });
        } else {
            console.log(`[findSegmented] No se encontró opción (individual ni combinada) para ${format(currentDate, 'yyyy-MM-dd')} con capacidad ${requiredCapacity}`);
            return { combination: [], capacity: 0, dailyOptions: [] };
        }
    }

    console.log(`[findSegmented] Opciones diarias encontradas: ${dailyOptions.length}`);
    return { combination: dailyOptions, capacity: requiredCapacity, dailyOptions: dailyOptions };
}


// --- Función calculatePrice (Sin cambios, verifica la llamada a obtenerValorDolar) ---
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };

    // *** LLAMADA A obtenerValorDolar ***
    // Asegurarse de que la función importada esté disponible aquí
    const valorDolarDia = valorDolarDiaOverride ??
                          ((canalPorDefecto.moneda === 'USD' || canalObjetivo.moneda === 'USD')
                              ? await obtenerValorDolar(db, empresaId, startDate) // <--- PUNTO CRÍTICO
                              : null);

    let totalPrecioOriginal = 0;
    const priceDetails = [];
    let totalNights = differenceInDays(endDate, startDate);
    if (totalNights <= 0 && !isSegmented) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };


    if (isSegmented) {
        totalNights = 0;
        for (const dailyOption of items) {
            const currentDate = dailyOption.date;
            const option = dailyOption.option;
            const propertiesForDay = Array.isArray(option) ? option : [option];
            totalNights++;

            let dailyRateBase = 0;
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

            let dailyRateModified = dailyRateBase;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    dailyRateModified *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
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

             priceDetails.push({
                 date: format(currentDate, 'yyyy-MM-dd'),
                 properties: propertiesForDay.map(p => ({id: p.id, nombre: p.nombre})),
                 dailyRate: dailyRateInTargetCurrency
             });
        }

    } else { // Cálculo NO segmentado
        for (const prop of items) {
            let propPrecioBaseTotal = 0;
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

            let precioPropModificado = propPrecioBaseTotal;
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
                id: prop.id,
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
    findSegmentedCombination,
    calculatePrice
};