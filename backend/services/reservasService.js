const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const q = reservasRef.where('idReservaCanal', '==', datosReserva.idReservaCanal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = { id: nuevaReservaRef.id, ...datosReserva, fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), edicionesManuales: {} };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        const reservaDoc = snapshot.docs[0];
        const reservaExistente = reservaDoc.data();
        const ediciones = reservaExistente.edicionesManuales || {};
        
        let hayCambios = false;
        const datosAActualizar = {};

        // --- INICIO DE LA NUEVA LÓGICA DE AUTOSANACIÓN DE MONEDA ---
        // Si la moneda del canal no coincide con la de la reserva, se corrige.
        if (!ediciones.moneda && reservaExistente.moneda !== datosReserva.moneda) {
            datosAActualizar.moneda = datosReserva.moneda;
            hayCambios = true;
        }

        // Si la moneda ES o SERÁ USD y le faltan los datos del dólar, los calcula.
        if ((datosAActualizar.moneda === 'USD' || reservaExistente.moneda === 'USD') && !reservaExistente.valorDolarDia && !ediciones['valores.valorTotal']) {
            const valorDolar = await obtenerValorDolar(db, empresaId, reservaExistente.fechaLlegada.toDate());
            if (valorDolar) {
                datosAActualizar.valorDolarDia = valorDolar;
                // Usa el valor original del reporte para el cálculo.
                if (datosReserva.valores && datosReserva.valores.valorOriginal) {
                    datosAActualizar['valores.valorTotal'] = datosReserva.valores.valorOriginal * valorDolar;
                }
                hayCambios = true;
            }
        }
        // --- FIN DE LA NUEVA LÓGICA ---
        
        if (!ediciones.estado && reservaExistente.estado !== datosReserva.estado) {
            datosAActualizar.estado = datosReserva.estado;
            hayCambios = true;
        }
        if (!ediciones.alojamientoId && !reservaExistente.alojamientoId) {
            datosAActualizar.alojamientoId = datosReserva.alojamientoId;
            hayCambios = true;
        }
        if (!ediciones.fechaLlegada && reservaExistente.fechaLlegada.toDate().getTime() !== datosReserva.fechaLlegada.getTime()) {
            datosAActualizar.fechaLlegada = datosReserva.fechaLlegada;
            hayCambios = true;
        }
        if (!ediciones.fechaSalida && reservaExistente.fechaSalida.toDate().getTime() !== datosReserva.fechaSalida.getTime()) {
            datosAActualizar.fechaSalida = datosReserva.fechaSalida;
            hayCambios = true;
        }
        
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
    if (!reservaDoc.exists) throw new Error('La reserva no existe.');
    
    const reservaExistente = reservaDoc.data();
    const edicionesManuales = reservaExistente.edicionesManuales || {};

    if (datosNuevos.fechaLlegada) datosNuevos.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada));
    if (datosNuevos.fechaSalida) datosNuevos.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida));

    Object.keys(datosNuevos).forEach(key => {
        const valorNuevo = datosNuevos[key];
        const valorExistente = reservaExistente[key];
        if (typeof valorNuevo === 'object' && valorNuevo !== null && !Array.isArray(valorNuevo)) {
            Object.keys(valorNuevo).forEach(subKey => {
                if (JSON.stringify(valorExistente?.[subKey]) !== JSON.stringify(valorNuevo[subKey])) {
                    edicionesManuales[`${key}.${subKey}`] = true;
                }
            });
        } else if (JSON.stringify(valorExistente) !== JSON.stringify(valorNuevo)) {
            edicionesManuales[key] = true;
        }
    });

    const datosAActualizar = { ...datosNuevos, edicionesManuales, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() };
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

const obtenerReservaPorId = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const doc = await reservaRef.get();
    if (!doc.exists) throw new Error('Reserva no encontrada');
    const data = doc.data();
    return {
        ...data,
        fechaLlegada: data.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: data.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: data.fechaReserva?.toDate().toISOString().split('T')[0] || null,
    };
};

const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};

module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    eliminarReserva
};