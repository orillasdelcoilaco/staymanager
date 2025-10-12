// backend/services/estadosService.js
const admin = require('firebase-admin');

const crearEstado = async (db, empresaId, datosEstado) => {
    if (!empresaId || !datosEstado.nombre) {
        throw new Error('El nombre del estado es requerido.');
    }
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
    const snapshot = await db.collection('empresas').doc(empresaId).collection('estadosReserva').orderBy('orden').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarEstado = async (db, empresaId, estadoId, datosActualizados) => {
    const estadoRef = db.collection('empresas').doc(empresaId).collection('estadosReserva').doc(estadoId);
    await estadoRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: estadoId, ...datosActualizados };
};

const eliminarEstado = async (db, empresaId, estadoId) => {
    // Aquí se podría añadir una validación para no permitir borrar estados en uso.
    await db.collection('empresas').doc(empresaId).collection('estadosReserva').doc(estadoId).delete();
};

module.exports = {
    crearEstado,
    obtenerEstados,
    actualizarEstado,
    eliminarEstado
};