// backend/services/reservasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { deleteFileByUrl, uploadFile, renameFileByUrl } = require('./storageService'); 
const { updateGoogleContact } = require('./googleContactsService');
const idUpdateManifest = require('../config/idUpdateManifest');
const path = require('path');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const q = reservasRef.where('idUnicoReserva', '==', datosReserva.idUnicoReserva);
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
        
        if (datosReserva.idCarga && reservaExistente.idCarga !== datosReserva.idCarga) {
            datosAActualizar.idCarga = datosReserva.idCarga;
            hayCambios = true;
        }

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
            id: doc.id,
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
    const reservaData = doc.data();
    
    const idReservaOriginal = reservaData.idReservaCanal;
    if (!idReservaOriginal) {
         throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }

    const grupoSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaOriginal)
        .get();
    
    const reservasIndividuales = grupoSnapshot.docs.map(d => d.data());

    const [clienteDoc, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get(),
        db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get()
    ]);

    const cliente = clienteDoc.exists ? clienteDoc.data() : {};
    const notas = notasSnapshot.docs.map(d => ({...d.data(), fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const transacciones = transaccionesSnapshot.docs.map(d => ({...d.data(), id: d.id, fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));

    const valorTotalHuesped = reservasIndividuales.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0);
    const costoCanal = reservasIndividuales.reduce((sum, r) => sum + (r.valores?.comision || r.valores?.costoCanal || 0), 0);
    const valorPotencial = reservasIndividuales.reduce((sum, r) => sum + (r.valores?.valorPotencial || 0), 0);
    const abonoTotal = transacciones.reduce((sum, t) => sum + (t.monto || 0), 0);

    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente,
        notas,
        transacciones,
        datosAgregados: {
            valorTotalHuesped,
            costoCanal,
            valorPotencial,
            abonoTotal,
            payoutFinalReal: valorTotalHuesped - costoCanal,
        }
    };
};

const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};

const actualizarValoresGrupo = async (db, empresaId, valoresCabanas, nuevoTotalHuesped) => {
    const batch = db.batch();
    
    const docs = await Promise.all(valoresCabanas.map(item => 
        db.collection('empresas').doc(empresaId).collection('reservas').doc(item.id).get()
    ));

    let totalHuespedActual = 0;
    docs.forEach(doc => {
        if (doc.exists) {
            totalHuespedActual += doc.data().valores.valorHuesped || 0;
        }
    });

    if (totalHuespedActual === 0) throw new Error("El valor actual del grupo es cero, no se puede calcular la proporción.");

    const proporcion = parseFloat(nuevoTotalHuesped) / totalHuespedActual;

    docs.forEach(doc => {
        if (doc.exists) {
            const reserva = doc.data();
            const nuevosValores = { ...reserva.valores };
            const valorHuespedActualIndividual = nuevosValores.valorHuesped;

            if (!nuevosValores.valorHuespedOriginal || nuevosValores.valorHuespedOriginal === 0) {
                nuevosValores.valorHuespedOriginal = valorHuespedActualIndividual;
            }

            nuevosValores.valorHuesped = Math.round(valorHuespedActualIndividual * proporcion);

            batch.update(doc.ref, { 
                'valores': nuevosValores,
                'edicionesManuales.valores.valorHuesped': true,
                'ajusteManualRealizado': true
            });
        }
    });

    await batch.commit();
};

const calcularPotencialGrupo = async (db, empresaId, idsIndividuales, descuento) => {
    const batch = db.batch();
    for (const id of idsIndividuales) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        const doc = await ref.get();
        if(doc.exists) {
            const valorHuesped = doc.data().valores.valorHuesped || 0;
            if (valorHuesped > 0 && descuento > 0 && descuento < 100) {
                const valorPotencial = Math.round(valorHuesped / (1 - (parseFloat(descuento) / 100)));
                batch.update(ref, { 
                    'valores.valorPotencial': valorPotencial,
                    'edicionesManuales.valores.valorPotencial': true,
                    'potencialCalculado': true
                });
            }
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
    
    const transaccionDoc = await transaccionRef.get();
    if (!transaccionDoc.exists) {
        throw new Error('La transacción a eliminar no fue encontrada.');
    }
    const transaccionData = transaccionDoc.data();

    if (transaccionData.enlaceComprobante && transaccionData.enlaceComprobante !== 'SIN_DOCUMENTO') {
        await deleteFileByUrl(transaccionData.enlaceComprobante).catch(err => console.error(`Fallo al eliminar archivo de storage: ${err.message}`));
    }
    
    await transaccionRef.delete();

    if (transaccionData.tipo === 'Pago Final') {
        const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
        const q = reservasRef.where('idReservaCanal', '==', transaccionData.reservaIdOriginal);
        const snapshot = await q.get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { estadoGestion: 'Pendiente Pago' });
            });
            await batch.commit();
        }
    }
};

const actualizarDocumentoReserva = async (db, empresaId, idsIndividuales, tipoDocumento, url) => {
    const campo = tipoDocumento === 'boleta' ? 'documentos.enlaceBoleta' : 'documentos.enlaceReserva';

    if (url === null && idsIndividuales.length > 0) {
        const primeraReservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]);
        const primeraReservaDoc = await primeraReservaRef.get();
        if (primeraReservaDoc.exists) {
            const reservaData = primeraReservaDoc.data();
            const oldUrl = (tipoDocumento === 'boleta')
                ? reservaData.documentos?.enlaceBoleta
                : reservaData.documentos?.enlaceReserva;

            if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
                deleteFileByUrl(oldUrl).catch(err => console.error(`Fallo al eliminar archivo de storage: ${err.message}`));
            }
        }
    }

    const batch = db.batch();
    const updateData = {};
    if (url === null) {
        updateData[campo] = admin.firestore.FieldValue.delete();
    } else {
        updateData[campo] = url;
    }

    if (tipoDocumento === 'boleta' && (url || url === 'SIN_DOCUMENTO')) {
        updateData.estadoGestion = 'Pendiente Cliente';
    }

    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, updateData);
    });
    await batch.commit();
};

const gestionarDocumentoReserva = async (db, empresaId, reservaId, tipoDocumento, archivo, accion) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) {
        throw new Error("Reserva no encontrada");
    }

    const reservaData = reservaDoc.data();
    const campo = tipoDocumento === 'boleta' ? `documentos.enlaceBoleta` : `documentos.enlaceReserva`;
    const oldUrl = reservaData.documentos?.[tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva'];

    if (accion === 'delete') {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
            await deleteFileByUrl(oldUrl);
        }
        await reservaRef.update({ [campo]: admin.firestore.FieldValue.delete() });
    } else if (archivo) {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
            await deleteFileByUrl(oldUrl);
        }
        const year = new Date().getFullYear();
        const fileName = `${reservaData.idReservaCanal}_${tipoDocumento}_${Date.now()}${path.extname(archivo.originalname)}`;
        const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
        const publicUrl = await uploadFile(archivo.buffer, destination, archivo.mimetype);
        await reservaRef.update({ [campo]: publicUrl });
    } else {
        throw new Error("Acción no válida o archivo no proporcionado.");
    }

    const docActualizado = await reservaRef.get();
    return docActualizado.data();
};

const eliminarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();

    if (snapshot.empty) {
        return { eliminadas: 0, message: 'No se encontraron reservas para esta carga.' };
    }

    const batch = db.batch();
    const deletePromises = [];
    
    const reservaIdsOriginales = snapshot.docs.map(doc => doc.data().idReservaCanal);
    const uniqueReservaIds = [...new Set(reservaIdsOriginales)];

    const chunkSize = 30;
    for (let i = 0; i < uniqueReservaIds.length; i += chunkSize) {
        const chunk = uniqueReservaIds.slice(i, i + chunkSize);
        if (chunk.length > 0) {
            const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
            const transaccionesSnapshot = await transaccionesRef.where('reservaIdOriginal', 'in', chunk).get();

            transaccionesSnapshot.forEach(doc => {
                const transaccionData = doc.data();
                if (transaccionData.enlaceComprobante && transaccionData.enlaceComprobante !== 'SIN_DOCUMENTO') {
                    deletePromises.push(deleteFileByUrl(transaccionData.enlaceComprobante));
                }
                batch.delete(doc.ref);
            });
        }
    }

    snapshot.docs.forEach(doc => {
        const reservaData = doc.data();
        if (reservaData.documentos) {
            if (reservaData.documentos.enlaceReserva && reservaData.documentos.enlaceReserva !== 'SIN_DOCUMENTO') {
                deletePromises.push(deleteFileByUrl(reservaData.documentos.enlaceReserva));
            }
            if (reservaData.documentos.enlaceBoleta && reservaData.documentos.enlaceBoleta !== 'SIN_DOCUMENTO') {
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

const actualizarIdReservaCanalEnCascada = async (db, empresaId, idReserva, idAntiguo, idNuevo) => {
    if (!idAntiguo || !idNuevo || idAntiguo === idNuevo) {
        throw new Error("Se requieren un ID antiguo y uno nuevo, y deben ser diferentes.");
    }

    const summary = {
        firestore: {},
        storage: { renombrados: 0, errores: 0 },
        googleContacts: { actualizado: false, mensaje: 'No fue necesario actualizar.' }
    };
    
    const reservaDoc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idReserva).get();
    if (!reservaDoc.exists) throw new Error("La reserva principal no fue encontrada.");
    const reservaData = reservaDoc.data();

    // 1. Actualización en Google Contacts (fuera de la transacción)
    const clienteDoc = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();
    if (clienteDoc.exists && clienteDoc.data().googleContactSynced) {
        const clienteData = clienteDoc.data();
        const oldContactName = `${clienteData.nombre} ${reservaData.canalNombre} ${idAntiguo}`;
        const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').get();
        const canalNuevoNombre = canalesSnapshot.docs.find(doc => doc.id === reservaData.canalId)?.data().nombre || reservaData.canalNombre;

        const newContactData = { ...clienteData, canalNombre: canalNuevoNombre, idReservaCanal: idNuevo };
        try {
            const result = await updateGoogleContact(db, empresaId, oldContactName, newContactData);
            summary.googleContacts.actualizado = result.status === 'updated' || result.status === 'created';
            summary.googleContacts.mensaje = `Contacto en Google ${result.status}.`;
        } catch (error) {
            summary.googleContacts.mensaje = `Error al actualizar en Google: ${error.message}`;
        }
    }

    // 2. Actualización en Firestore (dentro de la transacción)
    await db.runTransaction(async (transaction) => {
        const updatesToPerform = [];
        
        for (const item of idUpdateManifest) {
            const collectionRef = db.collection('empresas').doc(empresaId).collection(item.collection);
            const snapshot = await transaction.get(collectionRef.where(item.field, '==', idAntiguo));
            
            summary.firestore[item.collection] = snapshot.size;

            snapshot.forEach(doc => {
                const updateData = { [item.field]: idNuevo };
                if (item.isGroupIdentifier) {
                    const docData = doc.data();
                    updateData['idUnicoReserva'] = `${idNuevo}-${docData.alojamientoId}`;
                    updateData['edicionesManuales.idReservaCanal'] = true;
                }
                updatesToPerform.push({ ref: doc.ref, data: updateData });
            });
        }

        updatesToPerform.forEach(update => {
            transaction.update(update.ref, update.data);
        });
    });

    // 3. Operaciones de Storage (fuera de la transacción)
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const transaccionesSnapshot = await transaccionesRef.where('reservaIdOriginal', '==', idNuevo).get();

    const batch = db.batch();
    for(const doc of transaccionesSnapshot.docs) {
        const transaccion = doc.data();
        if (transaccion.enlaceComprobante && transaccion.enlaceComprobante.includes(idAntiguo)) {
            try {
                const nuevaUrl = await renameFileByUrl(transaccion.enlaceComprobante, idNuevo);
                if (nuevaUrl !== transaccion.enlaceComprobante) {
                    batch.update(doc.ref, { enlaceComprobante: nuevaUrl });
                    summary.storage.renombrados++;
                }
            } catch (error) {
                summary.storage.errores++;
            }
        }
    }
    await batch.commit();

    return summary;
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
    gestionarDocumentoReserva,
    eliminarReservasPorIdCarga,
    contarReservasPorIdCarga,
    actualizarIdReservaCanalEnCascada
};