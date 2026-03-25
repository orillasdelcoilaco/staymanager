// backend/services/gestionPropuestas.read.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

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

function _agruparReservasFS(propuestasItems, propiedadesMap) {
    const agrupadas = new Map();
    propuestasItems.forEach(({ doc }) => {
        const data = doc.data();
        const id = data.idReservaCanal;
        if (!id) return;
        if (!agrupadas.has(id)) {
            agrupadas.set(id, {
                id, tipo: 'propuesta', origen: data.origen || 'manual',
                clienteId: data.clienteId, clienteNombre: data.clienteNombre,
                canalId: data.canalId, canalNombre: data.canalNombre,
                idReservaCanal: id, icalUid: data.icalUid || null,
                fechaLlegada: data.fechaLlegada.toDate().toISOString().split('T')[0],
                fechaSalida:  data.fechaSalida.toDate().toISOString().split('T')[0],
                monto: 0, propiedades: [], idsReservas: [], personas: 0,
            });
        }
        const g = agrupadas.get(id);
        g.monto += data.valores?.valorHuesped || 0;
        const prop = propiedadesMap.get(data.alojamientoId) || { nombre: data.alojamientoNombre, capacidad: 0 };
        g.propiedades.push({ id: data.alojamientoId, nombre: prop.nombre, capacidad: prop.capacidad });
        g.idsReservas.push(doc.id);
        g.personas += data.cantidadHuespedes || 0;
    });
    return agrupadas;
}

function _enriquecer(resultado, clientesMap) {
    resultado.forEach(item => {
        if (item.clienteId && clientesMap.has(item.clienteId)) item.clienteNombre = clientesMap.get(item.clienteId).nombre;
        item.propiedadesNombres = (item.propiedades || []).map(p => p.nombre).join(', ');
    });
    return resultado;
}

async function _fetchInBatchesFS(db, empresaId, collection, ids) {
    const results = new Map();
    for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        if (batch.length > 0) {
            const snap = await db.collection('empresas').doc(empresaId).collection(collection).where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
            snap.forEach(doc => results.set(doc.id, doc.data()));
        }
    }
    return results;
}

const obtenerPropuestasYPresupuestos = async (db, empresaId) => {
    if (pool) {
        const [reservaRes, presupuestoRes] = await Promise.all([
            pool.query(`SELECT id, id_reserva_canal, cliente_id, alojamiento_nombre, canal_id, canal_nombre, fecha_llegada, fecha_salida, propiedad_id, valores, cantidad_huespedes, metadata FROM reservas WHERE empresa_id = $1 AND estado = 'Propuesta' ORDER BY created_at DESC`, [empresaId]),
            pool.query(`SELECT id, estado, datos FROM presupuestos WHERE empresa_id = $1 AND estado IN ('Borrador','Enviado') ORDER BY created_at DESC`, [empresaId]),
        ]);
        const reservaRows = reservaRes.rows;
        const presupuestoRows = presupuestoRes.rows;
        const clienteIds = [...new Set([...reservaRows.map(r => r.cliente_id), ...presupuestoRows.map(r => r.datos?.clienteId)].filter(Boolean))];
        const propiedadIds = [...new Set([...reservaRows.map(r => r.propiedad_id), ...presupuestoRows.flatMap(r => (r.datos?.propiedades || []).map(p => p.id))].filter(Boolean))];
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
            return { id: r.id, tipo: 'presupuesto', estado: r.estado, ...data, propiedades: props, clienteNombre: clientesMap.get(data.clienteId)?.nombre || data.clienteNombre, personas: props.reduce((s, p) => s + (p.capacidad || 0), 0) };
        });
        return _enriquecer([...agrupadas.values(), ...presupuestos], clientesMap);
    }

    // Firestore fallback
    const [propuestasSnap, presupuestosSnap] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').where('estado', '==', 'Propuesta').orderBy('fechaCreacion', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('presupuestos').where('estado', 'in', ['Borrador', 'Enviado']).orderBy('fechaCreacion', 'desc').get()
    ]);
    const propuestasItems = [], presupuestosItems = [];
    propuestasSnap.forEach(doc => propuestasItems.push({ doc, type: 'propuesta' }));
    presupuestosSnap.forEach(doc => presupuestosItems.push({ doc, type: 'presupuesto' }));
    if (propuestasItems.length === 0 && presupuestosItems.length === 0) return [];

    const neededClientIds = new Set([...propuestasItems, ...presupuestosItems].map(i => i.doc.data().clienteId).filter(Boolean));
    const allPropIds = new Set();
    [...propuestasItems, ...presupuestosItems].forEach(i => {
        const data = i.doc.data();
        if (data.propiedades) data.propiedades.forEach(p => allPropIds.add(p.id));
        if (data.alojamientoId) allPropIds.add(data.alojamientoId);
    });
    const [clientesMap, propiedadesMap] = await Promise.all([
        _fetchInBatchesFS(db, empresaId, 'clientes', Array.from(neededClientIds)),
        _fetchInBatchesFS(db, empresaId, 'propiedades', Array.from(allPropIds)),
    ]);
    const agrupadas = _agruparReservasFS(propuestasItems, propiedadesMap);
    const presupuestos = presupuestosItems.map(({ doc }) => {
        const data = doc.data();
        const props = data.propiedades.map(p => ({ ...p, capacidad: propiedadesMap.get(p.id)?.capacidad || 0 }));
        const cliente = clientesMap.get(data.clienteId);
        return { id: doc.id, tipo: 'presupuesto', ...data, propiedades: props, clienteNombre: cliente?.nombre || data.clienteNombre, personas: props.reduce((s, p) => s + (p.capacidad || 0), 0) };
    });
    return _enriquecer([...agrupadas.values(), ...presupuestos], clientesMap);
};

module.exports = { obtenerPropuestasYPresupuestos };
