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
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            edicionesManuales: {}
        };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        const reservaDoc = snapshot.docs[0];
        const reservaExistente = reservaDoc.data();
        const ediciones = reservaExistente.edicionesManuales || {};
        
        let hayCambios = false;
        const datosAActualizar = {};

        // Lógica de actualización para el estado
        if (!ediciones.estado && reservaExistente.estado !== datosReserva.estado && datosReserva.estado) {
            datosAActualizar.estado = datosReserva.estado;
            hayCambios = true;
        }

        // Lógica de actualización para el alojamiento
        if (!ediciones.alojamientoId && (!reservaExistente.alojamientoId || reservaExistente.alojamientoNombre === 'Alojamiento no identificado') && datosReserva.alojamientoId) {
            datosAActualizar.alojamientoId = datosReserva.alojamientoId;
            datosAActualizar.alojamientoNombre = datosReserva.alojamientoNombre;
            hayCambios = true;
        }

        // --- INICIO DE LA MODIFICACIÓN ---
        // Lógica mejorada para actualizar fechas si son diferentes
        const fechaLlegadaExistente = reservaExistente.fechaLlegada?.toDate().getTime();
        const fechaLlegadaNueva = datosReserva.fechaLlegada?.getTime();
        if (!ediciones.fechaLlegada && fechaLlegadaExistente !== fechaLlegadaNueva && fechaLlegadaNueva) {
            datosAActualizar.fechaLlegada = datosReserva.fechaLlegada;
            hayCambios = true;
        }

        const fechaSalidaExistente = reservaExistente.fechaSalida?.toDate().getTime();
        const fechaSalidaNueva = datosReserva.fechaSalida?.getTime();
        if (!ediciones.fechaSalida && fechaSalidaExistente !== fechaSalidaNueva && fechaSalidaNueva) {
            datosAActualizar.fechaSalida = datosReserva.fechaSalida;
            hayCambios = true;
        }
        // --- FIN DE LA MODIFICACIÓN ---
        
        if (hayCambios) {
            datosAActualizar.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();
            await reservaDoc.ref.update(datosAActualizar);
            const dataActualizada = { ...reservaExistente, ...datosAActualizar };
            return { reserva: dataActualizada, status: 'actualizada' };
        } else {
            return { reserva: reservaExistente, status: 'sin_cambios' };
        }
    }
};

const actualizarReservaManualmente = async (db, empresaId, reservaId, datosNuevos) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) {
        throw new Error('La reserva no existe.');
    }
    const reservaExistente = reservaDoc.data();
    const edicionesManuales = reservaExistente.edicionesManuales || {};

    const datosAActualizar = { ...datosNuevos };

    Object.keys(datosNuevos).forEach(key => {
        if (JSON.stringify(reservaExistente[key]) !== JSON.stringify(datosNuevos[key])) {
            edicionesManuales[key] = true;
        }
    });

    datosAActualizar.edicionesManuales = edicionesManuales;
    datosAActualizar.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();
    
    await reservaRef.update(datosAActualizar);
    return { id: reservaId, ...datosAActualizar };
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    const [reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    if (reservasSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    return reservasSnapshot.docs.map(doc => {
        const data = doc.data();
        const cliente = clientesMap.get(data.clienteId);
        
        return {
            ...data,
            telefono: cliente ? cliente.telefono : 'N/A',
            nombreCliente: cliente ? cliente.nombre : 'Cliente no encontrado',
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
    actualizarReservaManualmente,
    eliminarReserva
};