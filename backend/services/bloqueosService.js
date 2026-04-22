// backend/services/bloqueosService.js
// Gestión de bloqueos de alojamientos (mantenimiento, cierre temporal, etc.)
// Un bloqueo puede afectar uno, varios, o todos los alojamientos de una empresa.

const pool = require('../db/postgres');

function mapearBloqueo(row) {
    const m = row.metadata || {};
    return {
        id: row.id,
        todos: m.todos || row.propiedad_id === null && !m.alojamientoIds?.length,
        alojamientoIds: m.alojamientoIds || (row.propiedad_id ? [row.propiedad_id] : []),
        fechaInicio: row.fecha_inicio instanceof Date
            ? row.fecha_inicio.toISOString().split('T')[0]
            : String(row.fecha_inicio),
        fechaFin: row.fecha_fin instanceof Date
            ? row.fecha_fin.toISOString().split('T')[0]
            : String(row.fecha_fin),
        motivo: row.motivo || '',
        creadoPor: m.creadoPor || '',
    };
}

const crearBloqueo = async (_db, empresaId, datos, usuarioEmail) => {
    const { alojamientoIds = [], todos = false, fechaInicio, fechaFin, motivo } = datos;

    if (!fechaInicio || !fechaFin) throw new Error('fechaInicio y fechaFin son requeridos.');
    if (!todos && alojamientoIds.length === 0) throw new Error('Selecciona al menos un alojamiento.');

    const inicio = new Date(fechaInicio + 'T00:00:00Z');
    const fin    = new Date(fechaFin    + 'T00:00:00Z');
    if (fin < inicio) throw new Error('La fecha de fin debe ser igual o posterior a la fecha de inicio.');

    const metadata = {
        todos,
        alojamientoIds: todos ? [] : alojamientoIds,
        creadoPor: usuarioEmail || '',
    };
    const propiedadId = (!todos && alojamientoIds.length === 1) ? alojamientoIds[0] : null;
    const { rows } = await pool.query(
        `INSERT INTO bloqueos (empresa_id, propiedad_id, fecha_inicio, fecha_fin, motivo, metadata)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [empresaId, propiedadId, fechaInicio, fechaFin, motivo || '', JSON.stringify(metadata)]
    );
    return mapearBloqueo(rows[0]);
};

const listarBloqueos = async (_db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT * FROM bloqueos WHERE empresa_id = $1 ORDER BY fecha_inicio DESC',
        [empresaId]
    );
    return rows.map(mapearBloqueo);
};

const eliminarBloqueo = async (_db, empresaId, bloqueoId) => {
    const { rowCount } = await pool.query(
        'DELETE FROM bloqueos WHERE id = $1 AND empresa_id = $2',
        [bloqueoId, empresaId]
    );
    if (!rowCount) throw new Error('Bloqueo no encontrado.');
};

// ── Query helpers (usados por iCal, calendario y KPI) ────────
/**
 * Devuelve bloqueos cuyo rango se superpone con [startDate, endDate].
 * Si propiedadId se provee, filtra por esa propiedad (o bloqueos "todos").
 */
const getBloqueosPorPeriodo = async (_db, empresaId, startDate, endDate, propiedadId = null) => {
    const startISO = startDate.toISOString().split('T')[0];
    const endISO   = endDate.toISOString().split('T')[0];
    const { rows } = await pool.query(
        `SELECT * FROM bloqueos
         WHERE empresa_id = $1
           AND fecha_fin   >= $2
           AND fecha_inicio <= $3`,
        [empresaId, startISO, endISO]
    );
    return rows.map(mapearBloqueo).filter(b => {
        if (!propiedadId) return true;
        return b.todos || b.alojamientoIds.includes(propiedadId);
    });
};

module.exports = { crearBloqueo, listarBloqueos, eliminarBloqueo, getBloqueosPorPeriodo };
