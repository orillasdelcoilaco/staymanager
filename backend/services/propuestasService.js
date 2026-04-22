// backend/services/propuestasService.js

const pool = require('../db/postgres');
const { parseISO, isValid, addDays, format } = require('date-fns');
const { listarBloqueos } = require('./bloqueosService');

// Reduce la capacidad de propiedades que tienen camarotes/literas cuando el filtro está activo
function reducirCapacidadSinCamarotes(properties) {
    return properties.map(prop => {
        let numCamarotes = 0;
        if (prop.camas && prop.camas.camarotes > 0) {
            numCamarotes += prop.camas.camarotes;
        }
        if (prop.componentes && Array.isArray(prop.componentes)) {
            prop.componentes.forEach(comp => {
                (comp.elementos || []).forEach(elem => {
                    const nombre = (elem.nombre || '').toLowerCase();
                    if (nombre.includes('camarote') || nombre.includes('litera')) {
                        numCamarotes += (elem.cantidad || 1);
                    }
                });
            });
        }
        if (numCamarotes > 0) {
            return { ...prop, capacidad: Math.max(0, prop.capacidad - numCamarotes * 2) };
        }
        return prop;
    });
}

// pg puede retornar columnas DATE como objetos Date o como strings "YYYY-MM-DD".
// Esta función normaliza ambos casos a un Date UTC medianoche.
function _pgDateToUTC(val) {
    if (val instanceof Date) return new Date(val.toISOString().split('T')[0] + 'T00:00:00Z');
    return parseISO(String(val).split('T')[0] + 'T00:00:00Z');
}

async function _fetchAvailabilityPG(empresaId, endDate) {
    const endStr = endDate.toISOString().split('T')[0];
    const [propRes, tarifaRes, reservaRes, bloqueos] = await Promise.all([
        pool.query('SELECT * FROM propiedades WHERE empresa_id = $1 AND activo = true', [empresaId]),
        pool.query(`SELECT ta.id, ta.propiedad_id, ta.precios_canales,
                           te.fecha_inicio, te.fecha_termino
                    FROM tarifas ta JOIN temporadas te ON te.id = ta.temporada_id
                    WHERE ta.empresa_id = $1`, [empresaId]),
        pool.query(
            `SELECT propiedad_id, id_reserva_canal, fecha_llegada, fecha_salida
             FROM reservas WHERE empresa_id = $1 AND fecha_llegada < $2 AND estado = ANY($3)`,
            [empresaId, endStr, ['Confirmada', 'Propuesta']]
        ),
        listarBloqueos(null, empresaId),
    ]);
    const allProperties = propRes.rows.map(r => ({ id: r.id, nombre: r.nombre, capacidad: r.capacidad, ...(r.metadata || {}) }));
    const allTarifas = tarifaRes.rows.map(row => {
        try {
            const fi = _pgDateToUTC(row.fecha_inicio);
            const ft = _pgDateToUTC(row.fecha_termino);
            if (!isValid(fi) || !isValid(ft)) return null;
            return { alojamientoId: row.propiedad_id, precios: row.precios_canales || {}, fechaInicio: fi, fechaTermino: ft };
        } catch { return null; }
    }).filter(Boolean);
    const allReservas = reservaRes.rows.map(r => ({
        alojamientoId: r.propiedad_id, idReservaCanal: r.id_reserva_canal,
        fechaLlegada: new Date(r.fecha_llegada), fechaSalida: new Date(r.fecha_salida),
    }));
    const allBloqueos = bloqueos.map(b => ({
        todos: b.todos, alojamientoIds: b.alojamientoIds,
        fechaInicio: new Date(b.fechaInicio + 'T00:00:00Z'),
        fechaFin:    new Date(b.fechaFin    + 'T00:00:00Z'),
    }));
    return { allProperties, allTarifas, allReservas, allBloqueos };
}

function _cadaNocheConTarifa(propId, allTarifas, startDate, endDate) {
    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const covered = allTarifas.some(t =>
            t.alojamientoId === propId &&
            t.fechaInicio <= d &&
            t.fechaTermino >= d
        );
        if (!covered) return false;
    }
    return true;
}

function _buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate, idGrupoAExcluir) {
    const propiedadesConTarifa = allProperties.filter(prop =>
        _cadaNocheConTarifa(prop.id, allTarifas, startDate, endDate)
    );
    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));

    for (const reserva of allReservas) {
        if (idGrupoAExcluir && reserva.idReservaCanal === idGrupoAExcluir) continue;
        const s = reserva.fechaSalida instanceof Date ? reserva.fechaSalida : null;
        if (s && isValid(s) && s > startDate && availabilityMap.has(reserva.alojamientoId)) {
            const st = reserva.fechaLlegada instanceof Date ? reserva.fechaLlegada : null;
            if (st && isValid(st)) availabilityMap.get(reserva.alojamientoId).push({ start: st, end: s });
        }
    }
    // fechaFin es inclusivo → +1 día
    for (const b of allBloqueos) {
        const bInicio = b.fechaInicio instanceof Date ? b.fechaInicio : new Date(b.fechaInicio);
        const bFin    = new Date((b.fechaFin instanceof Date ? b.fechaFin : new Date(b.fechaFin)).getTime() + 86400000);
        if (bInicio >= endDate) continue;
        const ids = b.todos ? allProperties.map(p => p.id) : (b.alojamientoIds || []);
        ids.forEach(id => { if (availabilityMap.has(id)) availabilityMap.get(id).push({ start: bInicio, end: bFin }); });
    }
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });
    return { availableProperties, allProperties, allTarifas, availabilityMap, propiedadesConTarifa };
}

// --- Función getAvailabilityData ---
async function getAvailabilityData(_db, empresaId, startDate, endDate, sinCamarotes = false, idGrupoAExcluir = null) {
    const fetched = await _fetchAvailabilityPG(empresaId, endDate);

    let { allProperties, allTarifas, allReservas, allBloqueos } = fetched;
    if (sinCamarotes) allProperties = reducirCapacidadSinCamarotes(allProperties);
    return _buildAvailabilityResult(allProperties, allTarifas, allReservas, allBloqueos, startDate, endDate, idGrupoAExcluir);
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