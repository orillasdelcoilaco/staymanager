// backend/services/reservasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal, getValoresCLP } = require('./utils/calculoValoresService');
const { registrarAjusteValor } = require('./utils/trazabilidadService');
const idUpdateManifest = require('../config/idUpdateManifest');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    let q = reservasRef.where('idUnicoReserva', '==', datosReserva.idUnicoReserva);
    let snapshot = await q.get();

    if (snapshot.empty) {
        const qIcal = reservasRef
            .where('alojamientoId', '==', datosReserva.alojamientoId)
            .where('origen', '==', 'ical')
            .where('estado', '==', 'Propuesta')
            .where('fechaLlegada', '<=', admin.firestore.Timestamp.fromDate(datosReserva.fechaLlegada))
            .where('fechaSalida', '>=', admin.firestore.Timestamp.fromDate(datosReserva.fechaLlegada));
        
        snapshot = await qIcal.get();
    }

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

        if (reservaExistente.origen === 'ical') {
            datosAActualizar.idUnicoReserva = datosReserva.idUnicoReserva;
            datosAActualizar.idReservaCanal = datosReserva.idReservaCanal;
            datosAActualizar.origen = 'reporte';
            hayCambios = true;
        }

        const nuevosValores = { ...reservaExistente.valores, ...datosReserva.valores };
        for (const key in datosReserva.valores) {
            if (!ediciones[`valores.${key}`]) {
                if (nuevosValores[key] !== datosReserva.valores[key]) {
                    hayCambios = true;
                }
            }
        }
        datosAActualizar.valores = nuevosValores;

        const camposSimples = ['moneda', 'estado', 'alojamientoId', 'fechaLlegada', 'fechaSalida', 'clienteId', 'estadoGestion'];
        camposSimples.forEach(campo => {
            if (!ediciones[campo] && datosReserva[campo] !== undefined && JSON.stringify(reservaExistente[campo]) !== JSON.stringify(datosReserva[campo])) {
                datosAActualizar[campo] = datosReserva[campo];
                hayCambios = true;
            }
        });
        
        if (datosReserva.idCarga && reservaExistente.idCarga !== datosReserva.idCarga) {
            datosAActualizar.idCarga = datosReserva.idCarga;
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

const actualizarReservaManualmente = async (db, empresaId, usuarioEmail, reservaId, datosNuevos) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);

    const datosFinales = await db.runTransaction(async (transaction) => {
        const reservaDoc = await transaction.get(reservaRef);
        if (!reservaDoc.exists) throw new Error('La reserva no existe.');
        
        const reservaExistente = reservaDoc.data();
        const edicionesManuales = reservaExistente.edicionesManuales || {};
        const valoresExistentes = reservaExistente.valores || {};
    
        let nuevosValores = { ...(datosNuevos.valores || {}) };
        let datosNuevosNivelSuperior = { ...datosNuevos };
        delete datosNuevosNivelSuperior.valores;
        delete datosNuevosNivelSuperior.ajustes; // Obsoleto, se elimina
    
        if (datosNuevos.fechaLlegada) datosNuevosNivelSuperior.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada + 'T00:00:00Z'));
        if (datosNuevos.fechaSalida) datosNuevosNivelSuperior.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida + 'T00:00:00Z'));
    
        // 1. Determinar el valor del dólar a usar (Lógica Fijo/Flotante)
        let valorDolarUsado = null;
        const moneda = reservaExistente.moneda || 'CLP';
        const fechaActual = new Date();
        fechaActual.setUTCHours(0, 0, 0, 0);
        const fechaLlegada = reservaExistente.fechaLlegada?.toDate ? reservaExistente.fechaLlegada.toDate() : null;
        const esFacturado = datosNuevos.estadoGestion === 'Facturado' || reservaExistente.estadoGestion === 'Facturado';
        const esPasado = fechaLlegada && fechaLlegada < fechaActual;
        const esFijo = esFacturado || esPasado;
    
        if (moneda !== 'CLP') {
            if (esFijo) {
                valorDolarUsado = valoresExistentes.valorDolarFacturacion || (fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor);
            } else {
                valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
            }
        } else {
            valorDolarUsado = 1;
        }

        // Variables para el log de trazabilidad
        const valorAnteriorUSD = valoresExistentes.valorHuespedOriginal || 0;
        let valorNuevoUSD = valorAnteriorUSD;
    
        // 2. Lógica de "Ajustar Cobro" (si el 'valorHuesped' CLP fue modificado)
        if (nuevosValores.valorHuesped !== undefined && nuevosValores.valorHuesped !== valoresExistentes.valorHuesped) {
            
            const nuevoValorHuespedCLP = nuevosValores.valorHuesped;
            let nuevoValorHuespedUSD_Calculado = 0;
    
            if (moneda !== 'CLP' && valorDolarUsado > 0) {
                nuevoValorHuespedUSD_Calculado = nuevoValorHuespedCLP / valorDolarUsado;
            } else {
                nuevoValorHuespedUSD_Calculado = nuevoValorHuespedCLP;
            }
            
            valorNuevoUSD = nuevoValorHuespedUSD_Calculado; // Guardar para el log
            
            const canal = await db.collection('empresas').doc(empresaId).collection('canales').doc(reservaExistente.canalId).get();
            const configuracionIva = canal.exists ? (canal.data().configuracionIva || 'incluido') : 'incluido';
            const comisionSumable_Orig = valoresExistentes.comisionOriginal || 0; 
    
            const valoresRecalculadosUSD = recalcularValoresDesdeTotal(
                nuevoValorHuespedUSD_Calculado, 
                configuracionIva, 
                comisionSumable_Orig
            );
    
            nuevosValores.valorHuespedOriginal = valoresRecalculadosUSD.valorHuespedOriginal;
            nuevosValores.valorTotalOriginal = valoresRecalculadosUSD.valorTotalOriginal;
            nuevosValores.ivaOriginal = valoresRecalculadosUSD.ivaOriginal;
            
            nuevosValores.valorHuesped = nuevoValorHuespedCLP;
            nuevosValores.valorTotal = Math.round(valoresRecalculadosUSD.valorTotalOriginal * valorDolarUsado);
            nuevosValores.iva = Math.round(valoresRecalculadosUSD.ivaOriginal * valorDolarUsado);
        }
    
        // 3. Lógica de "Facturación" (Congelación)
        if (datosNuevos.estadoGestion === 'Facturado' && reservaExistente.estadoGestion !== 'Facturado') {
            if (moneda !== 'CLP' && valorDolarUsado > 0) {
                nuevosValores.valorDolarFacturacion = valorDolarUsado;
            }
        }
        
        // 4. Crear el objeto final de datos a actualizar
        const datosAActualizar = {
            ...datosNuevosNivelSuperior,
            valores: {
                ...valoresExistentes,
                ...nuevosValores
            }
        };
    
        // 5. Calcular Ediciones Manuales
        Object.keys(datosAActualizar).forEach(key => {
            const valorNuevo = datosAActualizar[key];
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
        
        // 6. Fusionar todo para la BBDD
        const datosFinalesParaUpdate = {
            ...datosAActualizar,
            edicionesManuales,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };

        // 7. Registrar el log de trazabilidad
        await registrarAjusteValor(transaction, db, empresaId, reservaRef, {
            fuente: 'Gestionar Reservas (Editar)',
            usuarioEmail: usuarioEmail,
            valorAnteriorUSD: valorAnteriorUSD,
            valorNuevoUSD: valorNuevoUSD,
            valorDolarUsado: valorDolarUsado
        });
    
        transaction.update(reservaRef, datosFinalesParaUpdate);
        
        return { id: reservaId, ...datosFinalesParaUpdate };
    });

    return datosFinales;
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    
    const [reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    if (reservasSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    const reservasConCLP = await Promise.all(
        reservasSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            const valoresCLP = await getValoresCLP(db, empresaId, data);
            
            if (!data.valores) data.valores = {};
            data.valores.valorHuesped = valoresCLP.valorHuesped;
            data.valores.valorTotal = valoresCLP.payout;
            data.valores.comision = valoresCLP.comision;
            data.valores.costoCanal = valoresCLP.costoCanal;
            
            return { id: doc.id, data: data };
        })
    );

    return reservasConCLP.map(item => {
        const data = item.data;
        const cliente = clientesMap.get(data.clienteId);
        return {
            ...data,
            id: item.id,
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
       if (reservaData.origen === 'ical' && !reservaData.clienteId) {
            console.warn(`Reserva iCal ${reservaId} no tiene idReservaCanal. Devolviendo datos parciales.`);
            return {
                ...reservaData,
                fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
                fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
                fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
                cliente: {},
                notas: [],
                transacciones: [],
                datosIndividuales: { 
                    valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, 
                    valorPotencial: 0, descuentoPotencialPct: 0, abonoProporcional: 0, 
                    saldo: 0,
                    valorHuespedOriginal: 0,
                    valorHuespedCalculado: 0, 
                    costoCanalOriginal: 0, 
                    valorTotalOriginal: 0,
                    ivaOriginal: 0,
                    moneda: reservaData.moneda || 'CLP', valorDolarUsado: null,
                    valorPotencialOriginal_DB: 0,
                    esValorFijo: false,
                    historialAjustes: []
                },
                datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 }
            };
       }
         throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }

    const grupoSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaOriginal)
        .get();
    
    const reservasDelGrupo = grupoSnapshot.docs.map(d => d.data());

    let clientePromise;
    if (reservaData.clienteId) {
        clientePromise = db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();
    } else {
        clientePromise = Promise.resolve({ exists: false });
    }
    const [clienteDoc, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        clientePromise,
        db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get()
    ]);
    const cliente = clienteDoc.exists ? clienteDoc.data() : {};
    const notas = notasSnapshot.docs.map(d => ({...d.data(), fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const transacciones = transaccionesSnapshot.docs.map(d => ({...d.data(), id: d.id, fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));

    const valoresEnCLP = await getValoresCLP(db, empresaId, reservaData);
    const valorHuespedCLP = valoresEnCLP.valorHuesped;
    const valorDolarUsado = valoresEnCLP.valorDolarUsado;
    
    const valoresOriginales = reservaData.valores || {};
    const valorHuespedOriginal = valoresOriginales.valorHuespedOriginal || 0;
    const costoCanalOriginal = valoresOriginales.costoCanalOriginal || 0;
    const payoutOriginal = valoresOriginales.valorTotalOriginal || 0;
    const ivaOriginal = valoresOriginales.ivaOriginal || 0;
    
    const valorAnclaUSD = valoresOriginales.valorHuespedCalculado || 0;
    
    const historialAjustes = (reservaData.historialAjustes || []).map(log => ({
        ...log,
        fecha: log.fecha.toDate().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    })).sort((a, b) => {
        // Convertir fecha 'dd-MM-yyyy, HH:mm' a 'yyyy-MM-ddTHH:mm:ss' para comparación
        const partsA = a.fecha.split(', ');
        const dateA = partsA[0].split('-').reverse().join('-');
        const timeA = partsA[1];
        const isoA = `${dateA}T${timeA}`;

        const partsB = b.fecha.split(', ');
        const dateB = partsB[0].split('-').reverse().join('-');
        const timeB = partsB[1];
        const isoB = `${dateB}T${timeB}`;

        return new Date(isoA) - new Date(isoB);
    });


    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0),
        payoutTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorTotal || 0), 0),
        abonoTotal: transacciones.reduce((sum, t) => sum + (t.monto || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const abonoProporcional = (datosGrupo.valorTotal > 0)
        ? (valorHuespedCLP / datosGrupo.valorTotal) * datosGrupo.abonoTotal
     : 0;
    
    const valorCanalBase_Original = valoresOriginales.valorOriginal || 0;
    const valorCanalExterno_CLP = valorHuespedCLP;

    let valorCanalBase_CLP = 0;
    if (reservaData.moneda === 'CLP') {
        valorCanalBase_CLP = valorCanalBase_Original;
    } else if (reservaData.moneda !== 'CLP' && valorDolarUsado > 0) {
        valorCanalBase_CLP = valorCanalBase_Original * valorDolarUsado;
    }

    let valorPotencial_Monto = 0;
    let valorPotencial_Pct = 0;   

    if (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorCanalExterno_CLP) {
        valorPotencial_Monto = valorCanalBase_CLP - valorCanalExterno_CLP;
        valorPotencial_Pct = (valorPotencial_Monto / valorCanalBase_CLP) * 100;
    }

    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
     cliente,
        notas,
        transacciones,
        
        datosIndividuales: {
            valorTotalHuesped: valoresEnCLP.valorHuesped,
            costoCanal: valoresEnCLP.costoCanal,
            payoutFinalReal: valoresEnCLP.payout,
            iva: valoresEnCLP.iva,
            saldo: Math.round(valoresEnCLP.valorHuesped - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),

            valorHuespedOriginal: valorHuespedOriginal, 
            costoCanalOriginal: costoCanalOriginal,
            valorTotalOriginal: payoutOriginal,
            ivaOriginal: ivaOriginal,

            moneda: reservaData.moneda || 'CLP',
            valorDolarUsado: valoresEnCLP.valorDolarUsado,
            esValorFijo: valoresEnCLP.esValorFijo,

            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorPotencial_Pct,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP),
            
            valorOriginalCalculado: valorAnclaUSD,
            historialAjustes: historialAjustes
        },
        datosGrupo
    };
};

const decidirYEliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) {
        throw new Error('Reserva no encontrada.');
    }

    const reservaData = reservaDoc.data();
    const idReservaCanal = reservaData.idReservaCanal;

    if (!idReservaCanal) {
        await reservaRef.delete();
        return { status: 'individual_deleted', message: 'Reserva individual sin grupo eliminada.' };
    }

    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const notasRef = db.collection('empresas').doc(empresaId).collection('gestionNotas');

    const [transaccionesSnapshot, notasSnapshot] = await Promise.all([
        transaccionesRef.where('reservaIdOriginal', '==', idReservaCanal).limit(1).get(),
        notasRef.where('reservaIdOriginal', '==', idReservaCanal).limit(1).get()
    ]);
    
    // --- INICIO DE LA CORRECCIÓN ---
    // Verificamos si hay documentos adjuntos en la reserva individual
    const tieneDocumentos = reservaData.documentos && (reservaData.documentos.enlaceReserva || reservaData.documentos.enlaceBoleta);
    
    // Verificamos si hay CUALQUIER tipo de "basura"
    const estaLimpia = transaccionesSnapshot.empty && notasSnapshot.empty && !tieneDocumentos;
    // --- FIN DE LA CORRECCIÓN ---

    if (estaLimpia) {
        // Si no hay basura Y esta es la ÚLTIMA reserva del grupo, borramos.
        const grupoSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
            .where('idReservaCanal', '==', idReservaCanal).get();
        
        if (grupoSnapshot.size === 1) {
            await reservaRef.delete();
            return { status: 'individual_deleted', message: 'Reserva individual eliminada.' };
        }

        // Si hay otras reservas en el grupo, pero esta está "limpia", podemos borrarla.
        // (Aunque esto podría ser problemático si OTRA reserva del grupo tiene basura)
        // Por seguridad, vamos a chequear la basura de OTRAS reservas.
        
        // RE-EVALUACIÓN: El plan original es más seguro. Si hay basura *en cualquier parte* del grupo, se bloquea.
        // La lógica de `decidirYEliminarReserva` debe chequear la basura del GRUPO, no de la reserva individual.
        
        // ... (Volviendo a la lógica anterior que SÍ revisaba el grupo) ...
        // SI transacciones Y notas del GRUPO están vacías...
        if (transaccionesSnapshot.empty && notasSnapshot.empty) {
             // AHORA, debemos chequear si CUALQUIER reserva del grupo tiene documentos
             const grupoReservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('idReservaCanal', '==', idReservaCanal).get();
            
             const algunaReservaConDocumentos = grupoReservasSnapshot.docs.some(doc => 
                doc.data().documentos && (doc.data().documentos.enlaceReserva || doc.data().documentos.enlaceBoleta)
             );

             if (!algunaReservaConDocumentos) {
                 // El grupo COMPLETO está limpio (sin pagos, sin notas, sin documentos).
                 // Es seguro borrar solo esta reserva individual.
                await reservaRef.delete();
                return { status: 'individual_deleted', message: 'Reserva individual eliminada de un grupo limpio.' };
             }
        }
    }

    // --- CASO B: El grupo está "sucio" (tiene pagos, notas O documentos) ---
    const grupoReservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaCanal)
        .get();
        
    const grupoInfo = grupoReservasSnapshot.docs.map(doc => ({
        id: doc.id,
        nombre: doc.data().alojamientoNombre,
        valor: doc.data().valores?.valorHuesped || 0
    }));

    const error = new Error('Esta reserva tiene datos (pagos/notas/documentos) asociados. Solo se puede eliminar el grupo completo.');
    error.code = 409;
    error.data = {
        idReservaCanal: idReservaCanal,
        message: `Esta reserva es parte de un grupo que tiene datos vinculados (pagos, notas o documentos).`,
        grupoInfo: grupoInfo
    };
    throw error;
};

const eliminarGrupoReservasCascada = async (db, empresaId, idReservaCanal) => {
    const batch = db.batch();
    const collectionsToClean = idUpdateManifest.firestore.filter(item => item.collection !== 'reservas');
    
    for (const item of collectionsToClean) {
        const snapshot = await db.collection('empresas').doc(empresaId).collection(item.collection)
            .where(item.field, '==', idReservaCanal)
            .get();
        snapshot.forEach(doc => batch.delete(doc.ref));
    }

    const reservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaCanal)
        .get();
    reservasSnapshot.forEach(doc => batch.delete(doc.ref));
    
    // (Aquí faltaría la lógica de borrado de Storage, que es más compleja,
    // pero por ahora borramos la "basura" de Firestore)
    
    await batch.commit();
    return { status: 'group_deleted', deletedReservas: reservasSnapshot.size };
};

module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    decidirYEliminarReserva,
    eliminarGrupoReservasCascada,
};