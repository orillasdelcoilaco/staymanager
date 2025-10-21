// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            // *** CORRECCIÓN: Considerar Propuestas y Confirmadas como ocupadas ***
            .where('estado', 'in', ['Confirmada', 'Propuesta'])
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                // Restar la capacidad de los camarotes (asumiendo 2 personas por camarote)
                const capacidadReducida = prop.capacidad - (prop.camas.camarotes * 2);
                return { ...prop, capacidad: Math.max(0, capacidadReducida) }; // Asegurar que no sea negativo
            }
            return prop;
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
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);
    
    let combination = [];
    let currentCapacity = 0;
    
    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            combination.push(prop);
            currentCapacity += prop.capacidad;
        } else {
            break;
        }
    }

    if (currentCapacity < requiredCapacity) {
        return { combination: [], capacity: 0 };
    }

    return { combination, capacity: currentCapacity };
}

// *** INICIO CORRECCIÓN: Lógica de Búsqueda Segmentada ***
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    
    const allDailyOptions = [];
    let isPossible = true;

    // 1. Encontrar opciones CADA DÍA
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        
        // Propiedades disponibles ESE DÍA que cumplen la capacidad
        const dailyAvailable = allProperties.filter(prop => {
            // A. Debe tener capacidad suficiente
            if (prop.capacidad < requiredCapacity) return false;

            // B. Debe tener tarifa definida para ese día
            const hasTarifa = allTarifas.some(t => 
                t.alojamientoId === prop.id && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
            );
            if (!hasTarifa) return false;

            // C. No debe estar ocupada ese día
            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                currentDate >= res.start && currentDate < res.end
            );
            return !isOccupied;
        });

        if (dailyAvailable.length === 0) {
            isPossible = false; // Si un solo día falla, la segmentación no es posible
            break;
        }
        
        // Guardar la MEJOR opción (mayor capacidad) para ese día
        const bestOption = dailyAvailable.sort((a, b) => b.capacidad - a.capacidad)[0];
        allDailyOptions.push({ date: new Date(currentDate), option: bestOption });
    }

    if (!isPossible || allDailyOptions.length === 0) {
        return { combination: [], capacity: 0, dailyOptions: [] };
    }

    // 2. Construir el itinerario agrupando por la propiedad seleccionada
    let itinerary = [];
    let currentSegment = {
        propiedad: allDailyOptions[0].option, // Es un objeto propiedad, no un array
        startDate: allDailyOptions[0].date,
        endDate: new Date(new Date(allDailyOptions[0].date).setDate(allDailyOptions[0].date.getDate() + 1)) // El fin es la mañana siguiente
    };

    for (let i = 1; i < allDailyOptions.length; i++) {
        const day = allDailyOptions[i];
        
        // Si el día siguiente usa la MISMA propiedad
        if (day.option.id === currentSegment.propiedad.id) {
            // Extender el segmento
            currentSegment.endDate = new Date(new Date(day.date).setDate(day.date.getDate() + 1));
        } else {
            // Se rompió el segmento, guardar el anterior y empezar uno nuevo
            itinerary.push(currentSegment);
            currentSegment = {
                propiedad: day.option,
                startDate: day.date,
                endDate: new Date(new Date(day.date).setDate(day.date.getDate() + 1))
            };
        }
    }
    itinerary.push(currentSegment); // Añadir el último segmento
    
    // 'combination' es el itinerario
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}
// *** FIN CORRECCIÓN: Lógica de Búsqueda Segmentada ***


// *** INICIO CORRECCIÓN: Lógica de Cálculo de Precio Segmentado ***
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
    
    const valorDolarDia = valorDolarDiaOverride ?? await obtenerValorDolar(db, empresaId, startDate);

    let totalPrecioOriginal = 0; // Precio final en la moneda del canal objetivo
    const priceDetails = [];
    let totalNights = 0;

    if (isSegmented) {
        // 'items' es el itinerario: [{ propiedad: {...}, startDate: Date, endDate: Date }, ...]
        for (const segment of items) {
            const segmentStartDate = segment.startDate;
            const segmentEndDate = segment.endDate; // endDate es el día de check-out
            const segmentNights = Math.max(1, Math.round((segmentEndDate - segmentStartDate) / (1000 * 60 * 60 * 24)));
            totalNights += segmentNights;

            let propPrecioBaseTotalSegmento = 0;
            const prop = segment.propiedad; // La propiedad única para este segmento

            for (let d = new Date(segmentStartDate); d < segmentEndDate; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d);
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );

                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    const precioNocheBase = (canalPorDefecto.moneda === 'USD')
                        ? (precioBaseObj?.valorUSD ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0))
                        : (precioBaseObj?.valorCLP ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0));
                    propPrecioBaseTotalSegmento += precioNocheBase;
                }
            }
            
            // Aplicar modificador y conversión al total de la propiedad en el segmento
            let precioPropModificadoSegmento = propPrecioBaseTotalSegmento;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificadoSegmento *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    precioPropModificadoSegmento += (canalObjetivo.modificadorValor * segmentNights);
                }
            }

            let precioPropEnMonedaObjetivo = precioPropModificadoSegmento;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                precioPropEnMonedaObjetivo = precioPropModificadoSegmento * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificadoSegmento / valorDolarDia) : 0;
            }

            totalPrecioOriginal += precioPropEnMonedaObjetivo; // Sumar al total general

            priceDetails.push({
                nombre: prop.nombre, // Nombre de la propiedad del segmento
                precioTotal: precioPropEnMonedaObjetivo,
                precioPorNoche: segmentNights > 0 ? precioPropEnMonedaObjetivo / segmentNights : 0,
                // Añadir detalles del segmento
                noches: segmentNights,
                fechaInicio: segmentStartDate.toISOString().split('T')[0],
                fechaTermino: segmentEndDate.toISOString().split('T')[0]
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
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    const precioNocheBase = (canalPorDefecto.moneda === 'USD')
                        ? (precioBaseObj?.valorUSD ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0))
                        : (precioBaseObj?.valorCLP ?? (typeof precioBaseObj === 'number' ? precioBaseObj : 0));
                    propPrecioBaseTotal += precioNocheBase;
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
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
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
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return { 
        totalPriceCLP: Math.round(totalPriceCLP),
        totalPriceOriginal: totalPrecioOriginal,
        currencyOriginal: canalObjetivo.moneda,
        valorDolarDia,
        nights: totalNights, 
        details: priceDetails 
    };
}
// *** FIN CORRECCIÓN: Lógica de Cálculo de Precio Segmentado ***

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};