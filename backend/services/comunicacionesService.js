// backend/services/comunicacionesService.js
const pool = require('../db/postgres');

const registrarComunicacion = async (_db, empresaId, clienteId, datos) => {
    if (!clienteId) {
        console.warn('No se puede registrar comunicación sin clienteId');
        return null;
    }
    const { tipo, evento, asunto, plantillaId, destinatario, relacionadoCon, estado, messageId } = datos;
    const { rows } = await pool.query(
        `INSERT INTO comunicaciones
         (empresa_id, cliente_id, tipo, evento, asunto, plantilla_id, destinatario, relacion_tipo, relacion_id, estado, message_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at`,
        [
            empresaId, clienteId,
            tipo || 'email', evento || 'general', asunto || '',
            plantillaId || null, destinatario || '',
            relacionadoCon?.tipo || null, relacionadoCon?.id || null,
            estado || 'enviado', messageId || null,
        ]
    );
    return {
        id: rows[0].id, tipo: tipo || 'email', evento: evento || 'general',
        asunto: asunto || '', plantillaId: plantillaId || null, destinatario: destinatario || '',
        relacionadoCon: relacionadoCon || null, estado: estado || 'enviado',
        messageId: messageId || null, fechaEnvio: rows[0].created_at,
    };
};

const obtenerComunicacionesCliente = async (_db, empresaId, clienteId, limite = 50) => {
    const { rows } = await pool.query(
        `SELECT c.id, c.tipo, c.evento, c.asunto, c.plantilla_id, c.destinatario,
                c.relacion_tipo, c.relacion_id, c.estado, c.message_id, c.created_at,
                p.nombre AS plantilla_nombre
         FROM comunicaciones c
         LEFT JOIN plantillas p ON p.empresa_id = c.empresa_id AND p.id = c.plantilla_id
         WHERE c.empresa_id = $1 AND c.cliente_id = $2
         ORDER BY c.created_at DESC LIMIT $3`,
        [empresaId, clienteId, limite]
    );
    return rows.map(r => ({
        id: r.id, tipo: r.tipo, evento: r.evento, asunto: r.asunto,
        plantillaId: r.plantilla_id, plantillaNombre: r.plantilla_nombre || null,
        destinatario: r.destinatario,
        relacionadoCon: r.relacion_tipo ? { tipo: r.relacion_tipo, id: r.relacion_id } : null,
        estado: r.estado, messageId: r.message_id, fechaEnvio: r.created_at,
    }));
};

const obtenerComunicacionesPorRelacion = async (_db, empresaId, clienteId, tipoRelacion, idRelacion) => {
    const { rows } = await pool.query(
        `SELECT c.id, c.tipo, c.evento, c.asunto, c.plantilla_id, c.destinatario,
                c.relacion_tipo, c.relacion_id, c.estado, c.message_id, c.created_at,
                p.nombre AS plantilla_nombre
         FROM comunicaciones c
         LEFT JOIN plantillas p ON p.empresa_id = c.empresa_id AND p.id = c.plantilla_id
         WHERE c.empresa_id = $1 AND c.cliente_id = $2 AND c.relacion_tipo = $3 AND c.relacion_id = $4
         ORDER BY c.created_at DESC`,
        [empresaId, clienteId, tipoRelacion, idRelacion]
    );
    return rows.map(r => ({
        id: r.id, tipo: r.tipo, evento: r.evento, asunto: r.asunto,
        plantillaId: r.plantilla_id, plantillaNombre: r.plantilla_nombre || null,
        destinatario: r.destinatario,
        relacionadoCon: { tipo: r.relacion_tipo, id: r.relacion_id },
        estado: r.estado, messageId: r.message_id, fechaEnvio: r.created_at,
    }));
};

module.exports = { registrarComunicacion, obtenerComunicacionesCliente, obtenerComunicacionesPorRelacion };
