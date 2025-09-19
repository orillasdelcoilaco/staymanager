const admin = require('firebase-admin');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    const q = reservasRef.where('idReservaCanal', '==', datosReserva.idReservaCanal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = {
            id: nuevaReservaRef.id,
            ...datosReserva,
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        const reservaDoc = snapshot.docs[0];
        const reservaExistente = reservaDoc.data();
        
        // Comparamos solo el estado, que es lo más probable que cambie en una re-importación
        if (reservaExistente.estado !== datosReserva.estado) {
            const datosAActualizar = {
                ...datosReserva,
                fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
            };
            await reservaDoc.ref.update(datosAActualizar);
            return { reserva: { id: reservaDoc.id, ...datosAActualizar }, status: 'actualizada' };
        } else {
            return { reserva: reservaExistente, status: 'sin_cambios' };
        }
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