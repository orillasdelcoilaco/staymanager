// backend/services/gestionPropuestas.actions.js
const pool = require('../db/postgres');
const { getAvailabilityData } = require('./propuestasService');
const { marcarCuponComoUtilizado } = require('./cuponesService');
const { enviarEmailReservaConfirmada } = require('./gestionPropuestas.email');

async function _verificarConflictoPG(empresaId, propiedadId, alojamientoNombre, startDate, endDate) {
    const { rows } = await pool.query(
        `SELECT id_reserva_canal, canal_nombre, fecha_reserva FROM reservas
         WHERE empresa_id=$1 AND propiedad_id=$2 AND estado='Confirmada'
         AND fecha_llegada < $3 AND fecha_salida > $4 LIMIT 1`,
        [empresaId, propiedadId, endDate, startDate]
    );
    if (rows[0]) {
        const c = rows[0];
        const fechaReserva = c.fecha_reserva ? new Date(c.fecha_reserva).toLocaleDateString('es-CL') : 'una fecha no registrada';
        throw new Error(`La cabaña ${alojamientoNombre} ya no está disponible. Fue reservada por la reserva ${c.id_reserva_canal || 'Desconocido'} del canal ${c.canal_nombre}, creada el ${fechaReserva}.`);
    }
}

const verificarDisponibilidadPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) throw new Error("No se proporcionaron IDs de reserva para verificar.");
    const { rows } = await pool.query(`SELECT * FROM reservas WHERE id = ANY($1) AND empresa_id = $2`, [idsReservas, empresaId]);
    if (rows.length !== idsReservas.length) throw new Error('Una o más reservas de la propuesta no fueron encontradas.');
    const primera = rows[0];
    const startDate = new Date(primera.fecha_llegada);
    const endDate   = new Date(primera.fecha_salida);
    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));
    for (const r of rows) {
        if (!availableIds.has(r.propiedad_id)) {
            await _verificarConflictoPG(empresaId, r.propiedad_id, r.alojamiento_nombre, primera.fecha_llegada, primera.fecha_salida);
        }
    }
    return { disponible: true };
};

const aprobarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) throw new Error("No se proporcionaron IDs de reserva para aprobar.");
    const { rows } = await pool.query(`SELECT * FROM reservas WHERE id = ANY($1) AND empresa_id = $2`, [idsReservas, empresaId]);
    if (rows.length !== idsReservas.length) throw new Error('Una o más reservas de la propuesta no fueron encontradas.');
    const primera = rows[0];
    const startDate = new Date(primera.fecha_llegada);
    const endDate   = new Date(primera.fecha_salida);
    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));
    for (const r of rows) {
        if (!availableIds.has(r.propiedad_id)) await _verificarConflictoPG(empresaId, r.propiedad_id, r.alojamiento_nombre, primera.fecha_llegada, primera.fecha_salida);
    }
    await pool.query(
        `UPDATE reservas SET estado = 'Confirmada', estado_gestion = 'Pendiente Bienvenida', updated_at = NOW() WHERE id = ANY($1) AND empresa_id = $2`,
        [idsReservas, empresaId]
    );
    const codigoCupon = primera.metadata?.cuponUtilizado;
    if (codigoCupon) {
        await marcarCuponComoUtilizado(null, null, empresaId, codigoCupon, primera.id_reserva_canal, primera.cliente_id);
    }
    const precioTotal   = rows.reduce((s, r) => s + (r.valores?.valorHuesped || 0), 0);
    const totalPersonas = rows.reduce((s, r) => s + (r.cantidad_huespedes || 0), 0);
    const datosParaEmail = {
        clienteId: primera.cliente_id, reservaId: primera.id_reserva_canal,
        propiedades: rows.map(r => ({ nombre: r.alojamiento_nombre })),
        fechaLlegada: new Date(primera.fecha_llegada), fechaSalida: new Date(primera.fecha_salida),
        noches: primera.total_noches, personas: totalPersonas, precioFinal: precioTotal
    };
    if (datosParaEmail.clienteId) {
        try {
            await enviarEmailReservaConfirmada(db, empresaId, datosParaEmail);
        } catch (e) { console.error('❌ Error enviando email de confirmación:', e.message); }
    }
};

const aprobarPresupuesto = async (db, empresaId, presupuestoId) => {
    const { rows: presRows } = await pool.query('SELECT id, datos FROM presupuestos WHERE id=$1 AND empresa_id=$2', [presupuestoId, empresaId]);
    if (!presRows[0]) throw new Error('El presupuesto no fue encontrado.');
    const presupuesto = presRows[0].datos || {};
    const startDate = new Date(presupuesto.fechaLlegada + 'T00:00:00Z');
    const endDate   = new Date(presupuesto.fechaSalida  + 'T00:00:00Z');
    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));
    for (const prop of presupuesto.propiedades || []) {
        if (!availableIds.has(prop.id)) await _verificarConflictoPG(empresaId, prop.id, prop.nombre, presupuesto.fechaLlegada, presupuesto.fechaSalida);
    }
    const { rows: canalRows } = await pool.query(`SELECT id, nombre FROM canales WHERE empresa_id=$1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`, [empresaId]);
    if (!canalRows[0]) throw new Error("No se ha configurado un canal por defecto.");
    const canal = canalRows[0];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const prop of presupuesto.propiedades || []) {
            const valores = { valorHuesped: Math.round((presupuesto.monto || 0) / presupuesto.propiedades.length) };
            await client.query(
                `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre, canal_id, canal_nombre,
                    cliente_id, total_noches, estado, estado_gestion, moneda, valores, cantidad_huespedes, fecha_llegada, fecha_salida, metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Confirmada','Pendiente Bienvenida','CLP',$9,$10,$11,$12,$13)`,
                [empresaId, presupuestoId, prop.id, prop.nombre, canal.id, canal.nombre, presupuesto.clienteId, presupuesto.noches, JSON.stringify(valores), prop.capacidad || 0, presupuesto.fechaLlegada, presupuesto.fechaSalida, JSON.stringify({ origen: 'presupuesto', edicionesManuales: {} })]
            );
        }
        await client.query(`UPDATE presupuestos SET estado = 'Aprobado', updated_at = NOW() WHERE id = $1 AND empresa_id = $2`, [presupuestoId, empresaId]);
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

module.exports = { verificarDisponibilidadPropuesta, aprobarPropuesta, aprobarPresupuesto };
