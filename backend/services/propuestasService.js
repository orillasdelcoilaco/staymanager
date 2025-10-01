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
    const allTarifas = tarifasSnapshot.docs.map(doc => doc.data());

    const propiedadesConTarifa = allProperties.filter(prop => {
        return allTarifas.some(tarifa => {
            const inicioTarifa = new Date(tarifa.fechaInicio);
            const finTarifa = new Date(tarifa.fechaTermino);
            return tarifa.alojamientoId === prop.id && inicioTarifa <= endDate && finTarifa >= startDate;
        });
    });

    const overlappingReservations = [];
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        if (new Date(reserva.fechaSalida.toDate()) > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    const occupiedPropertyIds = new Set(overlappingReservations.map(reserva => reserva.alojamientoId));
    const availableProperties = propiedadesConTarifa.filter(prop => !occupiedPropertyIds.has(prop.id));

    return { availableProperties, allProperties, allTarifas, overlappingReservations };
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

async function calculatePrice(db, empresaId, items, startDate, endDate) {
    const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
        return { totalPrice: 0, nights: 0, details: [] };
    }

    let totalPrice = 0;
    const priceDetails = [];

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
                if (new Date(tarifa.fechaTermino) >= currentDate) {
                    // Prioridad a Directo o SODC para el precio de lista
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
    calculatePrice
};