// backend/services/gestionPropuestas.read.js
const pool = require('../db/postgres');

function _agruparReservasPG(reservaRows, propiedadesMap) {
    const agrupadas = new Map();
    for (const row of reservaRows) {
        const id = row.id_reserva_canal;
        if (!id) continue;
        if (!agrupadas.has(id)) {
            agrupadas.set(id, {
                id, tipo: 'propuesta', origen: row.metadata?.origen || 'manual',
                clienteId: row.cliente_id, clienteNombre: null,
                canalId: row.canal_id, canalNombre: row.canal_nombre,
                idReservaCanal: id, icalUid: row.metadata?.icalUid || null,
                fechaLlegada: row.fecha_llegada instanceof Date ? row.fecha_llegada.toISOString().split('T')[0] : String(row.fecha_llegada),
                fechaSalida:  row.fecha_salida  instanceof Date ? row.fecha_salida.toISOString().split('T')[0]  : String(row.fecha_salida),
                monto: 0, propiedades: [], idsReservas: [], personas: 0,
            });
        }
        const g = agrupadas.get(id);
        g.monto += row.valores?.valorHuesped || 0;
        const prop = propiedadesMap.get(row.propiedad_id) || { nombre: row.alojamiento_nombre, capacidad: 0 };
        g.propiedades.push({ id: row.propiedad_id, nombre: prop.nombre, capacidad: prop.capacidad });
        g.idsReservas.push(row.id);
        g.personas += row.cantidad_huespedes || 0;
    }
    return agrupadas;
}

function _enriquecer(resultado, clientesMap) {
    resultado.forEach(item => {
        if (item.clienteId && clientesMap.has(item.clienteId)) item.clienteNombre = clientesMap.get(item.clienteId).nombre;
        item.propiedadesNombres = (item.propiedades || []).map(p => p.nombre).join(', ');
    });
    return resultado;
}

const obtenerPropuestasYPresupuestos = async (_db, empresaId) => {
    const [reservaRes, presupuestoRes] = await Promise.all([
        pool.query(
            `SELECT id, id_reserva_canal, cliente_id, alojamiento_nombre, canal_id, canal_nombre,
                    fecha_llegada, fecha_salida, propiedad_id, valores, cantidad_huespedes, metadata
             FROM reservas WHERE empresa_id = $1 AND estado = 'Propuesta' ORDER BY fecha_llegada DESC NULLS LAST`,
            [empresaId]
        ),
        pool.query(
            `SELECT id, estado, datos FROM presupuestos WHERE empresa_id = $1 AND estado IN ('Borrador','Enviado') ORDER BY created_at DESC`,
            [empresaId]
        ),
    ]);
    const reservaRows = reservaRes.rows;
    const presupuestoRows = presupuestoRes.rows;

    const clienteIds = [...new Set([
        ...reservaRows.map(r => r.cliente_id),
        ...presupuestoRows.map(r => r.datos?.clienteId)
    ].filter(Boolean))];
    const propiedadIds = [...new Set([
        ...reservaRows.map(r => r.propiedad_id),
        ...presupuestoRows.flatMap(r => (r.datos?.propiedades || []).map(p => p.id))
    ].filter(Boolean))];

    const [cliRes, propRes] = await Promise.all([
        clienteIds.length ? pool.query('SELECT id, nombre FROM clientes WHERE empresa_id=$1 AND id = ANY($2)', [empresaId, clienteIds]) : { rows: [] },
        propiedadIds.length ? pool.query('SELECT id, nombre, capacidad FROM propiedades WHERE empresa_id=$1 AND id = ANY($2)', [empresaId, propiedadIds]) : { rows: [] },
    ]);

    const clientesMap = new Map(cliRes.rows.map(r => [r.id, r]));
    const propiedadesMap = new Map(propRes.rows.map(r => [r.id, r]));
    const agrupadas = _agruparReservasPG(reservaRows, propiedadesMap);
    const presupuestos = presupuestoRows.map(r => {
        const data = r.datos || {};
        const props = (data.propiedades || []).map(p => ({ ...p, capacidad: propiedadesMap.get(p.id)?.capacidad || 0 }));
        return {
            id: r.id, tipo: 'presupuesto', estado: r.estado, ...data,
            propiedades: props,
            clienteNombre: clientesMap.get(data.clienteId)?.nombre || data.clienteNombre,
            personas: props.reduce((s, p) => s + (p.capacidad || 0), 0)
        };
    });
    return _enriquecer([...agrupadas.values(), ...presupuestos], clientesMap);
};

module.exports = { obtenerPropuestasYPresupuestos };
