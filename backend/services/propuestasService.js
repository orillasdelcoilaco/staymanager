const admin = require('firebase-admin');

async function getAvailabilityData(db, empresaId, startDate, endDate) {
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', '==', 'Confirmada')
            .get()
    ]);

    const allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.fechaInicio && typeof data.fechaInicio.toDate === 'function' && data.fechaTermino && typeof data.fechaTermino.toDate === 'function') {
            return {
                ...data,
                fechaInicio: data.fechaInicio.toDate(),
                fechaTermino: data.fechaTermino.toDate()
            };
        }
        return null;
    }).filter(Boolean);

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

function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
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
            isPossible = false;
            break;
        }
        allDailyOptions.push({ date: new Date(currentDate), options: dailyAvailable });
    }

    if (!isPossible || allDailyOptions.length === 0) {
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
    
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, isSegmented = false) {
    let totalPrice = 0;
    const priceDetails = [];
    
    if (isSegmented) {
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
                const tarifaDoc = snapshot.docs[0];
                const tarifa = {
                    ...tarifaDoc.data(),
                    fechaTermino: tarifaDoc.data().fechaTermino.toDate()
                };

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
    return { totalPrice, nights, details: priceDetails };
}

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};