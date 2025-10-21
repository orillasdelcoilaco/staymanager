// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // ... (código sin cambios)
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta']) // Considerar propuestas también como ocupadas
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            // Ajustar capacidad si se excluyen camarotes
            const camasMatrimoniales = prop.camas?.matrimoniales || 0;
            const camasPlazaYMedia = prop.camas?.plazaYMedia || 0;
            // No sumar camarotes aquí si sinCamarotes es true
            const capacidadAjustada = (camasMatrimoniales * 2) + camasPlazaYMedia;
             // Asegurarse de que la capacidad no sea mayor que la original si no hay camarotes
            const capacidadFinal = Math.min(prop.capacidad, capacidadAjustada > 0 ? capacidadAjustada : prop.capacidad);
            return { ...prop, capacidad: capacidadFinal };

        });
    }


    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        let fechaInicio, fechaTermino;

        if (data.fechaInicio && typeof data.fechaInicio.toDate === 'function') {
            fechaInicio = data.fechaInicio.toDate();
        } else if (typeof data.fechaInicio === 'string') {
            fechaInicio = new Date(data.fechaInicio + 'T00:00:00Z');
        } else {
            return null;
        }

        if (data.fechaTermino && typeof data.fechaTermino.toDate === 'function') {
            fechaTermino = data.fechaTermino.toDate();
        } else if (typeof data.fechaTermino === 'string') {
            fechaTermino = new Date(data.fechaTermino + 'T00:00:00Z');
        } else {
            return null;
        }

        if (isNaN(fechaInicio.getTime()) || isNaN(fechaTermino.getTime())) {
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
        // Asegurarse de que fechaSalida sea un objeto Date
        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida);
        if (fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            availabilityMap.get(reserva.alojamientoId).push({
                start: reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : new Date(reserva.fechaLlegada),
                end: reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : new Date(reserva.fechaSalida)
            });
        }
    });

    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

function findNormalCombination(availableProperties, requiredCapacity) {
    // ... (código sin cambios)
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    let combination = [];
    let currentCapacity = 0;

    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            combination.push(prop);
            currentCapacity += prop.capacidad;
        } else {
            break; // Salir temprano si ya se alcanzó la capacidad
        }
    }

    // Verificar si se alcanzó la capacidad requerida
    if (currentCapacity < requiredCapacity) {
        return { combination: [], capacity: 0 }; // No se encontró combinación
    }

    return { combination, capacity: currentCapacity };
}


function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    // ... (código sin cambios)
    const areCombinationsEqual = (comboA, comboB) => {
        if (comboA.length !== comboB.length) return false;
        const idsA = comboA.map(p => p.id).sort();
        const idsB = comboB.map(p => p.id).sort();
        return idsA.every((id, index) => id === idsB[index]);
    };

    const allDailyOptions = [];
    let isPossible = true;

    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        const dailyAvailable = allProperties.filter(prop => {
            const hasTarifa = allTarifas.some(t =>
                t.alojamientoId === prop.id && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
            );
            if (!hasTarifa) return false;

            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                currentDate >= res.start && currentDate < res.end
            );
            return !isOccupied; // No filtrar por capacidad aquí, hacerlo en findNormalCombination
        });

        // Encontrar la mejor combinación para CADA día
        const dailyCombination = findNormalCombination(dailyAvailable, requiredCapacity);

        if (dailyCombination.combination.length === 0) {
            isPossible = false; // Imposible cumplir la capacidad en este día
            break;
        }
        allDailyOptions.push({ date: new Date(currentDate), options: dailyCombination.combination });
    }

    if (!isPossible || allDailyOptions.length === 0) {
        return { combination: [], capacity: 0, dailyOptions: [] };
    }

    // Construir itinerario basado en cambios de combinación
    let itinerary = [];
    if (allDailyOptions.length > 0) {
        let currentSegment = {
            propiedades: allDailyOptions[0].options, // Ahora es un array
            startDate: allDailyOptions[0].date,
            endDate: new Date(new Date(allDailyOptions[0].date).setDate(allDailyOptions[0].date.getDate() + 1))
        };

        for (let i = 1; i < allDailyOptions.length; i++) {
            const day = allDailyOptions[i];
            // Comparar si los arrays de propiedades son iguales
            if (areCombinationsEqual(day.options, currentSegment.propiedades)) {
                currentSegment.endDate = new Date(new Date(day.date).setDate(day.date.getDate() + 1));
            } else {
                itinerary.push(currentSegment);
                currentSegment = {
                    propiedades: day.options, // Nuevo array de propiedades
                    startDate: day.date,
                    endDate: new Date(new Date(day.date).setDate(day.date.getDate() + 1))
                };
            }
        }
        itinerary.push(currentSegment); // Añadir el último segmento
    }

    // El 'combination' ahora es el itinerario
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}


// *** INICIO DE LA CORRECCIÓN EN calculatePrice ***
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {

    // 1. Obtener Canales (sin cambios)
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };

    // 2. Determinar Valor del Dólar (usar override si viene, si no, buscarlo)
    const valorDolarDia = valorDolarDiaOverride ?? await obtenerValorDolar(db, empresaId, startDate);

    let totalPrecioOriginal = 0; // Precio final en la moneda del canal objetivo
    const priceDetails = [];
    let totalNights = 0;

    // 3. Calcular Precio (lógica ajustada)
    if (isSegmented) {
        // Calcular precio por segmento del itinerario
        for (const segment of items) { // 'items' ahora es el itinerario
            const segmentStartDate = segment.startDate;
            const segmentEndDate = segment.endDate;
            const segmentNights = Math.max(1, Math.round((segmentEndDate - segmentStartDate) / (1000 * 60 * 60 * 24)));
            totalNights += segmentNights;

            let segmentTotalPriceOriginal = 0; // Precio del segmento en moneda objetivo

            for (const prop of segment.propiedades) {
                let propPrecioBaseTotalSegmento = 0; // Precio base de ESTA prop en ESTE segmento (moneda default)

                for (let d = new Date(segmentStartDate); d < segmentEndDate; d.setDate(d.getDate() + 1)) {
                    const currentDate = new Date(d);
                    const tarifasDelDia = allTarifas.filter(t =>
                        t.alojamientoId === prop.id &&
                        t.fechaInicio <= currentDate &&
                        t.fechaTermino >= currentDate
                    );

                    if (tarifasDelDia.length > 0) {
                        const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                        // *** CORRECCIÓN CLAVE AQUÍ ***
                        // Leer el precio base numérico del canal por defecto
                        const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                        const precioNocheBase = (typeof precioBaseObj === 'number') ? precioBaseObj : (precioBaseObj?.valorCLP ?? precioBaseObj?.valorUSD ?? 0);
                        propPrecioBaseTotalSegmento += precioNocheBase;
                    }
                }
                 // Aplicar modificador y conversión al total de la propiedad en el segmento
                let precioPropModificadoSegmento = propPrecioBaseTotalSegmento;
                 // Aplicar modificador si el canal objetivo es diferente
                if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                    if (canalObjetivo.modificadorTipo === 'porcentaje') {
                        precioPropModificadoSegmento *= (1 + (canalObjetivo.modificadorValor / 100));
                    } else if (canalObjetivo.modificadorTipo === 'fijo') {
                        // El modificador fijo se aplica por noche en el segmento
                        precioPropModificadoSegmento += (canalObjetivo.modificadorValor * segmentNights);
                    }
                }
                // Convertir a la moneda objetivo si es necesario
                if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                     precioPropModificadoSegmento *= valorDolarDia;
                } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                    precioPropModificadoSegmento = valorDolarDia > 0 ? (precioPropModificadoSegmento / valorDolarDia) : 0;
                }

                segmentTotalPriceOriginal += precioPropModificadoSegmento;
            }
             totalPrecioOriginal += segmentTotalPriceOriginal; // Sumar al total general

             // Guardar detalle por segmento (opcional, útil para depurar)
             priceDetails.push({
                 propiedades: segment.propiedades.map(p=>p.nombre).join(', '),
                 fechaInicio: segmentStartDate.toISOString().split('T')[0],
                 fechaTermino: segmentEndDate.toISOString().split('T')[0],
                 noches: segmentNights,
                 precioTotalSegmento: segmentTotalPriceOriginal // Precio del segmento en moneda objetivo
             });
        }

    } else {
        // Calcular precio normal (no segmentado)
        totalNights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (totalNights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };

        for (const prop of items) { // 'items' es el array de propiedades
            let propPrecioBaseTotal = 0; // Precio base total de la propiedad (moneda default)

            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d);
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );

                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    // *** CORRECCIÓN CLAVE AQUÍ ***
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    // Leer el valor numérico correcto según la moneda del canal por defecto
                    const precioNocheBase = (canalPorDefecto.moneda === 'USD')
                        ? (precioBaseObj?.valorUSD ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0))
                        : (precioBaseObj?.valorCLP ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0));
                    propPrecioBaseTotal += precioNocheBase;
                }
            }

            // Aplicar modificador y conversión al total de la propiedad
            let precioPropModificado = propPrecioBaseTotal;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificado *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    // Modificador fijo se aplica por noche
                    precioPropModificado += (canalObjetivo.modificadorValor * totalNights);
                }
            }

            // Convertir a moneda objetivo
             let precioPropEnMonedaObjetivo = precioPropModificado;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificado / valorDolarDia) : 0;
            }

            totalPrecioOriginal += precioPropEnMonedaObjetivo; // Sumar al total general

            priceDetails.push({
                nombre: prop.nombre,
                // Guardar el precio de ESTA propiedad en la moneda OBJETIVO
                precioTotal: precioPropEnMonedaObjetivo,
                precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
            });
        }
    }

    // 4. Calcular totalPriceCLP (siempre necesario para frontend)
    let totalPriceCLP = totalPrecioOriginal;
    if (canalObjetivo.moneda === 'USD') {
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP), // Precio final total en CLP
        totalPriceOriginal: totalPrecioOriginal, // Precio final total en la moneda del canal OBJETIVO
        currencyOriginal: canalObjetivo.moneda, // Moneda del canal OBJETIVO
        valorDolarDia, // Dólar usado para conversión
        nights: totalNights,
        details: priceDetails // Detalles por propiedad (o segmento) en moneda OBJETIVO
    };
}
// *** FIN DE LA CORRECCIÓN EN calculatePrice ***


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};