const admin = require('firebase-admin');

async function getAvailabilityData(db, empresaId, startDate, endDate) {
    console.log('[Propuestas Service] getAvailabilityData: Iniciando...');
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', '==', 'Confirmada')
            .get()
    ]);
    console.log(`[Propuestas Service] getAvailabilityData: Se obtuvieron ${propiedadesSnapshot.size} propiedades, ${tarifasSnapshot.size} tarifas, ${reservasSnapshot.size} reservas.`);

    const allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.fechaInicio || !data.fechaTermino) {
            console.warn(`[Propuestas Service] getAvailabilityData: Tarifa con ID ${doc.id} omitida por no tener fechas.`);
            return null;
        }
        return {
            ...data,
            fechaInicio: data.fechaInicio.toDate(),
            fechaTermino: data.fechaTermino.toDate()
        };
    }).filter(Boolean);

    // ... (El resto de la lógica de la función se mantiene igual) ...
    const propiedadesConTarifa = allProperties.filter(prop => {
        return allTarifas.some(tarifa => {
            return tarifa.alojamientoId === prop.id && tarifa.fechaInicio <= endDate && tarifa.fechaTermino >= startDate;
        });
    });

    const overlappingReservations = [];
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        if (reserva.fechaSalida.toDate() > startDate) {
            overlappingReservations.push(reserva);
        }
    });
    
    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            availabilityMap.get(reserva.alojamientoId).push({
                start: reserva.fechaLlegada.toDate(),
                end: reserva.fechaSalida.toDate()
            });
        }
    });

    const occupiedPropertyIds = new Set(overlappingReservations.map(reserva => reserva.alojamientoId));
    const availableProperties = propiedadesConTarifa.filter(prop => !occupiedPropertyIds.has(prop.id));
    console.log('[Propuestas Service] getAvailabilityData: Finalizado.');
    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

function findNormalCombination(availableProperties, requiredCapacity) {
    console.log(`[Propuestas Service] findNormalCombination: Buscando combinación para ${requiredCapacity} personas.`);
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
        console.log('[Propuestas Service] findNormalCombination: No se encontró combinación suficiente.');
        return { combination: [], capacity: 0 };
    }
    console.log(`[Propuestas Service] findNormalCombination: Combinación encontrada con capacidad ${currentCapacity}.`);
    return { combination, capacity: currentCapacity };
}

function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
    console.log(`[Propuestas Service] findSegmentedCombination: Buscando itinerario para ${requiredCapacity} personas.`);
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
            return !isOccupied && prop.capacidad >= requiredCapacity;
        });

        if (dailyAvailable.length === 0) {
            console.error(`[Propuestas Service] findSegmentedCombination: No hay disponibilidad para el día ${currentDate.toISOString().split('T')[0]}`);
            isPossible = false;
            break;
        }
        allDailyOptions.push({ date: new Date(currentDate), options: dailyAvailable });
    }

    if (!isPossible || allDailyOptions.length === 0) {
        console.log('[Propuestas Service] findSegmentedCombination: No es posible generar un itinerario.');
        return { combination: [], capacity: 0, dailyOptions: [] };
    }

    let itinerary = [];
    let currentSegment = {
        propiedad: allDailyOptions[0].options[0],
        startDate: allDailyOptions[0].date,
        endDate: new Date(new Date(allDailyOptions[0].date).setDate(allDailyOptions[0].date.getDate() + 1))
    };

    for (let i = 1; i < allDailyOptions.length; i++) {
        const day = allDailyOptions[i];
        if (day.options.some(opt => opt.id === currentSegment.propiedad.id)) {
            currentSegment.endDate = new Date(new Date(day.date).setDate(day.date.getDate() + 1));
        } else {
            itinerary.push(currentSegment);
            currentSegment = {
                propiedad: day.options[0],
                startDate: day.date,
                endDate: new Date(new Date(day.date).setDate(day.date.getDate() + 1))
            };
        }
    }
    itinerary.push(currentSegment);
    console.log(`[Propuestas Service] findSegmentedCombination: Itinerario generado con ${itinerary.length} segmento(s).`);
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, isSegmented = false) {
    console.log('[Propuestas Service] calculatePrice: Iniciando cálculo de precios...');
    let totalPrice = 0;
    const priceDetails = [];
    
    if (isSegmented) {
        console.log('[Propuestas Service] calculatePrice: Calculando para itinerario segmentado.');
        for (const segment of items) {
            const segmentStartDate = new Date(segment.startDate);
            const segmentEndDate = new Date(segment.endDate);
            const segmentNights = Math.max(1, Math.round((segmentEndDate - segmentStartDate) / (1000 * 60 * 60 * 24)));
            const pricing = await calculatePrice(db, empresaId, [segment.propiedad], segmentStartDate, segmentEndDate);
            totalPrice += pricing.totalPrice;
            priceDetails.push({
                nombre: segment.propiedad.nombre,
                precioTotal: pricing.totalPrice,
                precioPorNoche: pricing.totalPrice > 0 ? pricing.totalPrice / segmentNights : 0,
                noches: segmentNights,
                fechaInicio: segmentStartDate.toISOString().split('T')[0],
                fechaTermino: segmentEndDate.toISOString().split('T')[0]
            });
        }
        const totalNightsOverall = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        console.log(`[Propuestas Service] calculatePrice: Finalizado (segmentado). Total: ${totalPrice}`);
        return { totalPrice, nights: totalNightsOverall, details: priceDetails };
    }

    const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
        return { totalPrice: 0, nights: 0, details: [] };
    }

    for (const prop of items) {
        let propTotalPrice = 0;
        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const q = db.collection('empresas').doc(empresaId).collection('tarifas')
                .where('alojamientoId', '==', prop.id)
                .where('fechaInicio', '<=', admin.firestore.Timestamp.fromDate(currentDate))
                .orderBy('fechaInicio', 'desc')
                .limit(1);
            
            const snapshot = await q.get();

            if (!snapshot.empty) {
                const tarifa = snapshot.docs[0].data();
                // AHORA USAMOS EL OBJETO DATE DIRECTAMENTE
                if (tarifa.fechaTermino && tarifa.fechaTermino >= currentDate) {
                    const precioNoche = tarifa.precios?.Directo?.valor || tarifa.precios?.SODC?.valor || 0;
                    propTotalPrice += precioNoche;
                }
            }
        }
        totalPrice += propTotalPrice;
        priceDetails.push({
            nombre: prop.nombre,
            precioTotal: propTotalPrice,
            precioPorNoche: propTotalPrice > 0 ? propTotalPrice / nights : 0,
        });
    }
    console.log(`[Propuestas Service] calculatePrice: Finalizado (normal). Total: ${totalPrice}`);
    return { totalPrice, nights, details: priceDetails };
}

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};