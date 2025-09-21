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
        if (reservaExistente.estado !== datosReserva.estado && datosReserva.estado) {
            datosAActualizar.estado = datosReserva.estado;
            hayCambios = true;
        }

        // 2. Reparamos el alojamiento si no estaba identificado
        if (!reservaExistente.alojamientoId && datosReserva.alojamientoId) {
            datosAActualizar.alojamientoId = datosReserva.alojamientoId;
            datosAActualizar.alojamientoNombre = datosReserva.alojamientoNombre;
            hayCambios = true;
        }

        // 3. Reparamos las fechas si faltaban
        if (!reservaExistente.fechaLlegada && datosReserva.fechaLlegada) {
            datosAActualizar.fechaLlegada = datosReserva.fechaLlegada;
            hayCambios = true;
        }
        if (!reservaExistente.fechaSalida && datosReserva.fechaSalida) {
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
    const snapshot = await db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get();
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        // Convertir Timestamps de Firestore a strings ISO para compatibilidad con el frontend
        return {
            ...data,
            fechaLlegada: data.fechaLlegada?.toDate().toISOString() || null,
            fechaSalida: data.fechaSalida?.toDate().toISOString() || null,
            fechaCreacion: data.fechaCreacion?.toDate().toISOString() || null,
            fechaActualizacion: data.fechaActualizacion?.toDate().toISOString() || null,
            fechaReserva: data.fechaReserva?.toDate().toISOString() || null
        };
    });
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