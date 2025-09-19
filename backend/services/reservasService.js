const admin = require('firebase-admin');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    const q = reservasRef.where('idReservaCanal', '==', datosReserva.idReservaCanal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        // --- La reserva es nueva, se crea como antes ---
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = {
            id: nuevaReservaRef.id,
            ...datosReserva,
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        // --- La reserva ya existe, aplicamos la lógica de actualización inteligente ---
        const reservaDoc = snapshot.docs[0];
        const reservaExistente = reservaDoc.data();
        
        let hayCambios = false;
        const datosAActualizar = {};

        // 1. Comparamos el estado
        if (reservaExistente.estado !== datosReserva.estado) {
            datosAActualizar.estado = datosReserva.estado;
            hayCambios = true;
        }

        // 2. Comparamos el alojamiento (reparamos si no estaba identificado)
        if (reservaExistente.alojamientoId === null && datosReserva.alojamientoId !== null) {
            datosAActualizar.alojamientoId = datosReserva.alojamientoId;
            datosAActualizar.alojamientoNombre = datosReserva.alojamientoNombre;
            hayCambios = true;
        }

        // 3. Comparamos las fechas (reparamos si faltaban)
        if (reservaExistente.fechaLlegada === null && datosReserva.fechaLlegada !== null) {
            datosAActualizar.fechaLlegada = datosReserva.fechaLlegada;
            hayCambios = true;
        }
        if (reservaExistente.fechaSalida === null && datosReserva.fechaSalida !== null) {
            datosAActualizar.fechaSalida = datosReserva.fechaSalida;
            hayCambios = true;
        }
        
        // Si detectamos algún cambio, actualizamos y reportamos
        if (hayCambios) {
            datosAActualizar.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();
            await reservaDoc.ref.update(datosAActualizar);
            const dataActualizada = { ...reservaExistente, ...datosAActualizar };
            return { reserva: dataActualizada, status: 'actualizada' };
        } else {
            // Si no hay ningún cambio, no hacemos nada
            return { reserva: reservaExistente, status: 'sin_cambios' };
        }
    }
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    // La consulta de ordenamiento la haremos en el frontend para evitar índices complejos
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