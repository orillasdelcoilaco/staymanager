// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { parseISO, isValid, addDays, format } = require('date-fns');

// --- Función getAvailabilityData ---
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false, idGrupoAExcluir = null) {
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
            let numCamarotes = 0;

            // 1. Revisar estructura Legacy
            if (prop.camas && prop.camas.camarotes > 0) {
                numCamarotes += prop.camas.camarotes;
            }

            // 2. Revisar nueva estructura (Componentes -> Elementos)
            if (prop.componentes && Array.isArray(prop.componentes)) {
                prop.componentes.forEach(comp => {
                    if (comp.elementos && Array.isArray(comp.elementos)) {
                        comp.elementos.forEach(elem => {
                            // Heurística: Buscar por nombre si es camarote/litera
                            const nombre = (elem.nombre || '').toLowerCase();
                            if (nombre.includes('camarote') || nombre.includes('litera')) {
                                numCamarotes += (elem.cantidad || 1);
                            }
                        });
                    }
                });
            }

            if (numCamarotes > 0) {
                // Asumimos que cada camarote aporta 2 plazas a la capacidad total.
                // Si el cliente no quiere camarotes, restamos esas plazas.
                const capacidadReducida = prop.capacidad - (numCamarotes * 2);
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
        } catch (e) { return null; }
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

        // Si esta reserva pertenece al grupo que estamos editando,
        // no la contamos como "ocupada".
        if (idGrupoAExcluir && reserva.idReservaCanal === idGrupoAExcluir) {
            return;
        }

        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
        // Solo añadir si la fecha de salida es *después* del inicio de nuestra búsqueda
        if (fechaSalidaReserva && isValid(fechaSalidaReserva) && fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));

    // Poblar el mapa de disponibilidad con las reservas filtradas
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            const start = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : (reserva.fechaLlegada ? parseISO(reserva.fechaLlegada + 'T00:00:00Z') : null);
            const end = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
            if (start && end && isValid(start) && isValid(end)) {
                availabilityMap.get(reserva.alojamientoId).push({ start, end });
            }
        }
    });

    // Calcular las propiedades disponibles
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}


// --- Función findNormalCombination ---
function findNormalCombination(availableProperties, requiredCapacity) {
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
        console.log(`[findNormalCombination] Combinación final encontrada: ${currentCombination.map(p => p.id).join(', ')} (Cap Total: ${currentCapacity})`);
        return { combination: currentCombination, capacity: currentCapacity };
    }

    console.log(`[findNormalCombination] No se encontró combinación válida para ${requiredCapacity} personas.`);
    return { combination: [], capacity: 0 };
}


// --- Función findSegmentedCombination ---
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {
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

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination
};