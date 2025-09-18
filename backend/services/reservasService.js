const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de reservas.
 */

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    // Usamos el ID de la reserva del canal como identificador único para evitar duplicados
    const q = reservasRef.where('idReservaCanal', '==', datosReserva.idReservaCanal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        // --- Crear Reserva Nueva ---
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = {
            id: nuevaReservaRef.id,
            ...datosReserva,
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await nuevaReservaRef.set(nuevaReserva);
        return { ...nuevaReserva, status: 'creada' };
    } else {
        // --- Actualizar Reserva Existente ---
        const reservaDoc = snapshot.docs[0];
        const datosAActualizar = {
            ...datosReserva, // Sobrescribimos con los datos más recientes del reporte
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await reservaDoc.ref.update(datosAActualizar);
        return { id: reservaDoc.id, ...datosAActualizar, status: 'actualizada' };
    }
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};


module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    eliminarReserva
};