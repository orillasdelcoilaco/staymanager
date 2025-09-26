const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { deleteFileByUrl } = require('./storageService'); // <-- Importar la nueva función

// ... (El resto de las funciones como crearOActualizarReserva, etc., no cambian)
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
            idCarga: datosReserva.idCarga
        };
        
        if (!ediciones['valores.valorTotal'] && !ediciones['valores.valorHuesped'] && !ediciones['valores.valorPotencial']) {
             if (JSON.stringify(reservaExistente.valores) !== JSON.stringify(datosReserva.valores)) {
                datosAActualizar.valores = datosReserva.valores;
                hayCambios = true;
            }
        }

        if (!ediciones.moneda && reservaExistente.moneda !== datosReserva.moneda) {
            datosAActualizar.moneda = datosReserva.moneda;
            hayCambios = true;
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
            batch.update(ref, { 'valores.valorPotencial': valorPotencial, 'edicionesManuales.valores.valorPotencial': true });
        }
    }
    await batch.commit();
};

const registrarPago = async (db, empresaId, detalles) => {
    const { idsIndividuales, monto, medioDePago, esPagoFinal, enlaceComprobante, reservaIdOriginal } = detalles;
    
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const nuevaTransaccion = {
        reservaIdOriginal,
        monto: parseFloat(monto),
        medioDePago,
        tipo: esPagoFinal ? 'Pago Final' : 'Abono',
        fecha: admin.firestore.FieldValue.serverTimestamp(),
        enlaceComprobante: enlaceComprobante || null
    };
    await transaccionesRef.add(nuevaTransaccion);

    const batch = db.batch();
    if (esPagoFinal) {
        idsIndividuales.forEach(id => {
            const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
            batch.update(ref, { estadoGestion: 'Pendiente Boleta' });
        });
        await batch.commit();
    }
};

const eliminarPago = async (db, empresaId, transaccionId) => {
    const transaccionRef = db.collection('empresas').doc(empresaId).collection('transacciones').doc(transaccionId);
    await transaccionRef.delete();
};

const actualizarDocumentoReserva = async (db, empresaId, idsIndividuales, tipoDocumento, url) => {
    const batch = db.batch();
    const campo = tipoDocumento === 'boleta' ? 'documentos.enlaceBoleta' : 'documentos.enlaceReserva';
    
    const updateData = {};
    if (url === null) {
        updateData[campo] = admin.firestore.FieldValue.delete();
    } else {
        updateData[campo] = url;
    }

    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, updateData);
    });
    await batch.commit();
};

const eliminarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();

    if (snapshot.empty) {
        return { eliminadas: 0, message: 'No se encontraron reservas para esta carga.' };
    }

    const batch = db.batch();
    const deletePromises = [];

    snapshot.docs.forEach(doc => {
        const reservaData = doc.data();
        if (reservaData.documentos) {
            if (reservaData.documentos.enlaceReserva) {
                deletePromises.push(deleteFileByUrl(reservaData.documentos.enlaceReserva));
            }
            if (reservaData.documentos.enlaceBoleta) {
                deletePromises.push(deleteFileByUrl(reservaData.documentos.enlaceBoleta));
            }
        }
        batch.delete(doc.ref);
    });
    
    await Promise.all(deletePromises);
    await batch.commit();

    return { eliminadas: snapshot.size };
};

const contarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();
    return { count: snapshot.size };
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
    eliminarPago,
    actualizarDocumentoReserva,
    eliminarReservasPorIdCarga,
    contarReservasPorIdCarga
};