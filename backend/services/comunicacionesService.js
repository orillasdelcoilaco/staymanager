// backend/services/comunicacionesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

const registrarComunicacion = async (db, empresaId, clienteId, datos) => {
    if (!clienteId) {
        console.warn('No se puede registrar comunicación sin clienteId');
        return null;
    }
    const { tipo, evento, asunto, plantillaId, destinatario, relacionadoCon, estado, messageId } = datos;

    if (pool) {
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
    }

    const ref = db.collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId).collection('comunicaciones').doc();
    const comunicacion = {
        id: ref.id,
        tipo: tipo || 'email', evento: evento || 'general', asunto: asunto || '',
        plantillaId: plantillaId || null, destinatario: destinatario || '',
        relacionadoCon: relacionadoCon || null, estado: estado || 'enviado',
        messageId: messageId || null, fechaEnvio: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(comunicacion);
    return comunicacion;
};

const obtenerComunicacionesCliente = async (db, empresaId, clienteId, limite = 50) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, tipo, evento, asunto, plantilla_id, destinatario, relacion_tipo, relacion_id, estado, message_id, created_at
             FROM comunicaciones WHERE empresa_id = $1 AND cliente_id = $2
             ORDER BY created_at DESC LIMIT $3`,
            [empresaId, clienteId, limite]
        );
        return rows.map(r => ({
            id: r.id, tipo: r.tipo, evento: r.evento, asunto: r.asunto,
            plantillaId: r.plantilla_id, destinatario: r.destinatario,
            relacionadoCon: r.relacion_tipo ? { tipo: r.relacion_tipo, id: r.relacion_id } : null,
            estado: r.estado, messageId: r.message_id, fechaEnvio: r.created_at,
        }));
    }

    const snapshot = await db.collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId).collection('comunicaciones')
        .orderBy('fechaEnvio', 'desc').limit(limite).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, fechaEnvio: data.fechaEnvio?.toDate?.() || null };
    });
};

const obtenerComunicacionesPorRelacion = async (db, empresaId, clienteId, tipoRelacion, idRelacion) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, tipo, evento, asunto, plantilla_id, destinatario, relacion_tipo, relacion_id, estado, message_id, created_at
             FROM comunicaciones
             WHERE empresa_id = $1 AND cliente_id = $2 AND relacion_tipo = $3 AND relacion_id = $4
             ORDER BY created_at DESC`,
            [empresaId, clienteId, tipoRelacion, idRelacion]
        );
        return rows.map(r => ({
            id: r.id, tipo: r.tipo, evento: r.evento, asunto: r.asunto,
            plantillaId: r.plantilla_id, destinatario: r.destinatario,
            relacionadoCon: { tipo: r.relacion_tipo, id: r.relacion_id },
            estado: r.estado, messageId: r.message_id, fechaEnvio: r.created_at,
        }));
    }

    const snapshot = await db.collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId).collection('comunicaciones')
        .where('relacionadoCon.tipo', '==', tipoRelacion)
        .where('relacionadoCon.id', '==', idRelacion)
        .orderBy('fechaEnvio', 'desc').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, fechaEnvio: data.fechaEnvio?.toDate?.() || null };
    });
};

module.exports = { registrarComunicacion, obtenerComunicacionesCliente, obtenerComunicacionesPorRelacion };
