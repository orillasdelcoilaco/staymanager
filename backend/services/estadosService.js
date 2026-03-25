// backend/services/estadosService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

function mapearEstado(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        color: row.color,
        orden: row.orden,
        esGestion: row.es_gestion,
        semantica: row.semantica,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

const crearEstado = async (db, empresaId, datosEstado) => {
    if (!empresaId || !datosEstado.nombre) {
        throw new Error('El nombre del estado es requerido.');
    }

    if (pool) {
        const { rows } = await pool.query(`
            INSERT INTO estados_reserva (empresa_id, nombre, color, orden, es_gestion, semantica)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            empresaId,
            datosEstado.nombre,
            datosEstado.color     || '#cccccc',
            datosEstado.orden     || 0,
            datosEstado.esGestion || false,
            datosEstado.semantica || null
        ]);
        return mapearEstado(rows[0]);
    }

    // Firestore fallback
    const estadoRef = db.collection('empresas').doc(empresaId).collection('estadosReserva').doc();
    const nuevoEstado = {
        id: estadoRef.id,
        ...datosEstado,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await estadoRef.set(nuevoEstado);
    return nuevoEstado;
};

const obtenerEstados = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM estados_reserva WHERE empresa_id = $1 ORDER BY orden ASC',
            [empresaId]
        );
        return rows.map(mapearEstado);
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('estadosReserva').orderBy('orden').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => doc.data());
};

const actualizarEstado = async (db, empresaId, estadoId, datosActualizados) => {
    if (pool) {
        await pool.query(`
            UPDATE estados_reserva SET
                nombre     = COALESCE($2, nombre),
                color      = COALESCE($3, color),
                orden      = COALESCE($4, orden),
                es_gestion = COALESCE($5, es_gestion),
                semantica  = COALESCE($6, semantica),
                updated_at = NOW()
            WHERE id = $1 AND empresa_id = $7
        `, [
            estadoId,
            datosActualizados.nombre    || null,
            datosActualizados.color     || null,
            datosActualizados.orden     !== undefined ? datosActualizados.orden     : null,
            datosActualizados.esGestion !== undefined ? datosActualizados.esGestion : null,
            datosActualizados.semantica !== undefined ? datosActualizados.semantica : null,
            empresaId
        ]);
        return { id: estadoId, ...datosActualizados };
    }

    // Firestore fallback
    await db.collection('empresas').doc(empresaId).collection('estadosReserva').doc(estadoId).update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: estadoId, ...datosActualizados };
};

const eliminarEstado = async (db, empresaId, estadoId) => {
    if (pool) {
        await pool.query(
            'DELETE FROM estados_reserva WHERE id = $1 AND empresa_id = $2',
            [estadoId, empresaId]
        );
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('estadosReserva').doc(estadoId).delete();
};

module.exports = {
    crearEstado,
    obtenerEstados,
    actualizarEstado,
    eliminarEstado
};
