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
        const datosAActualizar = {
            idCarga: datosReserva.idCarga // Siempre actualizamos el idCarga para auditoría
        };

        if (!ediciones.moneda && reservaExistente.moneda !== datosReserva.moneda) {
            datosAActualizar.moneda = datosReserva.moneda;
            hayCambios = true;
        }

        const valorTotalExistente = reservaExistente.valores?.valorTotal || 0;
        if (!ediciones['valores.valorTotal'] && valorTotalExistente === 0 && datosReserva.valores.valorTotal > 0) {
            datosAActualizar['valores.valorTotal'] = datosReserva.valores.valorTotal;
            hayCambios = true;
        }

        const monedaEfectiva = datosAActualizar.moneda || reservaExistente.moneda;
        if (monedaEfectiva === 'USD') {
            const necesitaReparacion = !reservaExistente.valorDolarDia || !reservaExistente.valores?.valorOriginal;
            if (necesitaReparacion && !ediciones['valores.valorTotal']) {
                const valorDolar = await obtenerValorDolar(db, empresaId, reservaExistente.fechaLlegada.toDate());
                if (valorDolar && datosReserva.valores?.valorOriginal) {
                    datosAActualizar.valorDolarDia = valorDolar;
                    datosAActualizar['valores.valorOriginal'] = datosReserva.valores.valorOriginal;
                    datosAActualizar['valores.valorTotal'] = datosReserva.valores.valorOriginal * valorDolar;
                    hayCambios = true;
                }
            }
        }
        
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
        
        if (hayCambios || reservaExistente.idCarga !== datosReserva.idCarga) {
            datosAActualizar.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();
            await reservaDoc.ref.update(datosAActualizar);
            const dataActualizada = { ...reservaExistente, ...datosAActualizar };
            return { reserva: dataActualizada, status: 'actualizada' };
        } else {
            return { reserva: reservaExistente, status: 'sin_cambios' };
        }
    }
};

// ... (El resto del archivo reservasService.js no necesita cambios)
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
    if (!doc.exists) {
        throw new Error('Reserva no encontrada');
    }
    const data = doc.data();
    let clienteData = {};
    if (data.clienteId) {
        const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(data.clienteId);
        const clienteDoc = await clienteRef.get();
        if (clienteDoc.exists) {
            clienteData = clienteDoc.data();
        }
    }
    return {
        ...data,
        fechaLlegada: data.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: data.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: data.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente: {
            nombre: clienteData.nombre || data.nombreCliente,
            telefono: clienteData.telefono || '',
            email: clienteData.email || ''
        }
    };
};

const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};

const actualizarValoresGrupo = async (db, empresaId, valoresCabanas) => {
    const batch = db.batch();
    for (const item of valoresCabanas) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(item.id);
        batch.update(ref, { 'valores.valorTotal': parseFloat(item.valor), 'edicionesManuales.valores.valorTotal': true });
    }
    await batch.commit();
};

const calcularPotencialGrupo = async (db, empresaId, idsIndividuales, descuento) => {
    const batch = db.batch();
    for (const id of idsIndividuales) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        const doc = await ref.get();
        if(doc.exists) {
            const valorActual = doc.data().valores.valorTotal;
            const valorPotencial = Math.round(valorActual / (1 - (parseFloat(descuento) / 100)));
            batch.update(ref, { 'valores.valorPotencial': valorPotencial });
        }
    }
    await batch.commit();
};

const registrarPago = async (db, empresaId, detalles) => {
    // Implementación detallada de la lógica de pago
};

const actualizarDocumentoReserva = async (db, empresaId, idsIndividuales, tipoDocumento, url) => {
     const batch = db.batch();
    const campo = tipoDocumento === 'boleta' ? 'documentos.enlaceBoleta' : 'documentos.enlaceReserva';
    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.set(ref, { documentos: { [campo.split('.')[1]]: url } }, { merge: true });
    });
    await batch.commit();
};


module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    eliminarReserva,
    actualizarValoresGrupo,
    calcularPotencialGrupo,
    registrarPago,
    actualizarDocumentoReserva
};