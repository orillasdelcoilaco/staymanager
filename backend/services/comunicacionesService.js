// backend/services/comunicacionesService.js
const admin = require('firebase-admin');

/**
 * Registra una comunicación en el historial del cliente
 * Subcolección: empresas/{empresaId}/clientes/{clienteId}/comunicaciones
 */
const registrarComunicacion = async (db, empresaId, clienteId, datos) => {
    if (!clienteId) {
        console.warn('No se puede registrar comunicación sin clienteId');
        return null;
    }

    const {
        tipo,           // 'email', 'whatsapp', 'sms', etc.
        evento,         // 'propuesta-enviada', 'reserva-confirmada', 'promocion', etc.
        asunto,
        plantillaId,
        destinatario,
        relacionadoCon, // { tipo: 'propuesta'|'reserva', id: '...' }
        estado,         // 'enviado', 'fallido', 'pendiente'
        messageId
    } = datos;

    const comunicacionRef = db
        .collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId)
        .collection('comunicaciones').doc();

    const comunicacion = {
        id: comunicacionRef.id,
        tipo: tipo || 'email',
        evento: evento || 'general',
        asunto: asunto || '',
        plantillaId: plantillaId || null,
        destinatario: destinatario || '',
        relacionadoCon: relacionadoCon || null,
        estado: estado || 'enviado',
        messageId: messageId || null,
        fechaEnvio: admin.firestore.FieldValue.serverTimestamp()
    };

    await comunicacionRef.set(comunicacion);

    return comunicacion;
};

/**
 * Obtiene el historial de comunicaciones de un cliente
 */
const obtenerComunicacionesCliente = async (db, empresaId, clienteId, limite = 50) => {
    const snapshot = await db
        .collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId)
        .collection('comunicaciones')
        .orderBy('fechaEnvio', 'desc')
        .limit(limite)
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            fechaEnvio: data.fechaEnvio?.toDate?.() || null
        };
    });
};

/**
 * Obtiene comunicaciones relacionadas con una reserva/propuesta específica
 */
const obtenerComunicacionesPorRelacion = async (db, empresaId, clienteId, tipoRelacion, idRelacion) => {
    const snapshot = await db
        .collection('empresas').doc(empresaId)
        .collection('clientes').doc(clienteId)
        .collection('comunicaciones')
        .where('relacionadoCon.tipo', '==', tipoRelacion)
        .where('relacionadoCon.id', '==', idRelacion)
        .orderBy('fechaEnvio', 'desc')
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            fechaEnvio: data.fechaEnvio?.toDate?.() || null
        };
    });
};

module.exports = {
    registrarComunicacion,
    obtenerComunicacionesCliente,
    obtenerComunicacionesPorRelacion
};