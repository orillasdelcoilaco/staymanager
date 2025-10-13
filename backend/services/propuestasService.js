// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // ... (código existente sin cambios)
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', '==', 'Confirmada')
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                const capacidadReducida = prop.capacidad - prop.camas.camarotes;
                return { ...prop, capacidad: capacidadReducida };
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

    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

function findNormalCombination(availableProperties, requiredCapacity) {
    // ... (código existente sin cambios)
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
    // ... (código existente sin cambios)
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
            return !isOccupied;
        });

        const dailyCombination = findNormalCombination(dailyAvailable, requiredCapacity);

        if (dailyCombination.combination.length === 0) {
            isPossible = false;
            break;
        }
        allDailyOptions.push({ date: new Date(currentDate), options: dailyCombination.combination });
    }

    if (!isPossible || allDailyOptions.length === 0) {
        return { combination: [], capacity: 0, dailyOptions: [] };
    }

    let itinerary = [];
    if (allDailyOptions.length > 0) {
        let currentSegment = {
            propiedades: allDailyOptions[0].options,
            startDate: allDailyOptions[0].date,
            endDate: new Date(new Date(allDailyOptions[0].date).setDate(allDailyOptions[0].date.getDate() + 1))
        };

        for (let i = 1; i < allDailyOptions.length; i++) {
            const day = allDailyOptions[i];
            if (areCombinationsEqual(day.options, currentSegment.propiedades)) {
                currentSegment.endDate = new Date(new Date(day.date).setDate(day.date.getDate() + 1));
            } else {
                itinerary.push(currentSegment);
                currentSegment = {
                    propiedades: day.options,
                    startDate: day.date,
                    endDate: new Date(new Date(day.date).setDate(day.date.getDate() + 1))
                };
            }
        }
        itinerary.push(currentSegment);
    }
    
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId) {
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };
    
    let totalPrecioBase = 0;
    const priceDetails = [];
    const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, nights: 0, details: [] };

    for (const prop of items) {
        let propPrecioBaseTotal = 0;
        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const tarifasDelDia = allTarifas.filter(t => 
                t.alojamientoId === prop.id &&
                t.fechaInicio <= currentDate &&
                t.fechaTermino >= currentDate
            );

            if (tarifasDelDia.length > 0) {
                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                const precioNocheBase = (tarifa.precios && tarifa.precios[canalPorDefecto.id]) ? tarifa.precios[canalPorDefecto.id] : 0;
                propPrecioBaseTotal += precioNocheBase;
            }
        }
        totalPrecioBase += propPrecioBaseTotal;
        priceDetails.push({
            nombre: prop.nombre,
            precioTotal: propPrecioBaseTotal, // Este es el precio base en la moneda del canal por defecto
            precioPorNoche: propPrecioBaseTotal > 0 ? propPrecioBaseTotal / nights : 0,
        });
    }

    let precioModificado = totalPrecioBase;
    if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
        if (canalObjetivo.modificadorTipo === 'porcentaje') {
            precioModificado *= (1 + (canalObjetivo.modificadorValor / 100));
        } else if (canalObjetivo.modificadorTipo === 'fijo') {
            precioModificado += canalObjetivo.modificadorValor;
        }
    }

    let totalPriceOriginal = precioModificado;
    let totalPriceCLP = precioModificado;
    let valorDolarDia = null;

    if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
        valorDolarDia = await obtenerValorDolar(db, empresaId, startDate);
        totalPriceCLP = Math.round(precioModificado * valorDolarDia);
    } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
        valorDolarDia = await obtenerValorDolar(db, empresaId, startDate);
        totalPriceOriginal = valorDolarDia > 0 ? (precioModificado / valorDolarDia) : 0;
    }

    return { 
        totalPriceCLP: Math.round(totalPriceCLP), 
        totalPriceOriginal: totalPriceOriginal,
        currencyOriginal: canalObjetivo.moneda,
        valorDolarDia,
        nights, 
        details: priceDetails 
    };
}


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};