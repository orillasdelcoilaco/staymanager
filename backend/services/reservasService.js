// backend/services/reservasService.js

const admin = require('firebase-admin');
const { crearOActualizarCliente } = require('./clientesService');

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

const actualizarReservaManualmente = async (db, empresaId, reservaId, datosNuevos) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) throw new Error('La reserva no existe.');
    
    const reservaExistente = reservaDoc.data();
    const edicionesManuales = reservaExistente.edicionesManuales || {};

    if (datosNuevos.fechaLlegada) datosNuevos.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada + 'T00:00:00Z'));
    if (datosNuevos.fechaSalida) datosNuevos.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida + 'T00:00:00Z'));

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
    
    // --- INICIO DE LA CORRECCIÓN ---
    // Bloque 'if' ELIMINADO. Ya no lanzamos un error para iCal.
    /*
    if (!reservaData.clienteId && reservaData.origen === 'ical') {
        throw new Error("Esta es una reserva provisional de iCal. ...");
    }
    */
    // --- FIN DE LA CORRECCIÓN ---
    
    const idReservaOriginal = reservaData.idReservaCanal;

    // --- INICIO CORRECCIÓN 2 ---
    // Si es iCal, no tiene cliente y (posiblemente) no tiene idReservaCanal,
    // devolvemos los datos parciales para el formulario de edición.
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
                datosIndividuales: { valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, valorPotencial: 0, descuentoPotencialPct: 0, abonoProporcional: 0, saldo: 0, ajusteCobro: 0, valorHuespedOriginal: 0 },
                datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 }
            };
       }
       // Si no es iCal y no tiene ID, es un error.
         throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }
    // --- FIN CORRECCIÓN 2 ---

    const grupoSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaOriginal)
        .get();
    
    const reservasDelGrupo = grupoSnapshot.docs.map(d => d.data());

    // --- INICIO CORRECCIÓN 3 ---
    // Hacer que la carga del cliente sea condicional
    let clientePromise;
    if (reservaData.clienteId) {
        clientePromise = db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();
    } else {
        clientePromise = Promise.resolve({ exists: false }); // Devolver cliente vacío
    }
    // --- FIN CORRECCIÓN 3 ---

    const [clienteDoc, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        clientePromise,
        db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get()
    ]);

    const cliente = clienteDoc.exists ? clienteDoc.data() : {};
    const notas = notasSnapshot.docs.map(d => ({...d.data(), fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const transacciones = transaccionesSnapshot.docs.map(d => ({...d.data(), id: d.id, fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));

    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0),
        payoutTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorTotal || 0), 0),
        abonoTotal: transacciones.reduce((sum, t) => sum + (t.monto || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const valorHuespedIndividual = reservaData.valores?.valorHuesped || 0;
    const abonoProporcional = (datosGrupo.valorTotal > 0)
        ? (valorHuespedIndividual / datosGrupo.valorTotal) * datosGrupo.abonoTotal
        : 0;
    
    const valorPotencial = reservaData.valores?.valorPotencial || 0;
    const descuentoPotencialPct = (valorPotencial > 0 && valorPotencial > valorHuespedIndividual)
        ? (1 - (valorHuespedIndividual / valorPotencial)) * 100
        : 0;

    const valorHuespedOriginal = reservaData.valores?.valorHuespedOriginal || 0;
    const ajusteCobro = (valorHuespedOriginal > 0 && valorHuespedOriginal !== valorHuespedIndividual)
        ? valorHuespedIndividual - valorHuespedOriginal
        : 0;


    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente,
        notas,
        transacciones,
        datosIndividuales: {
            valorTotalHuesped: valorHuespedIndividual,
            costoCanal: reservaData.valores?.comision || reservaData.valores?.costoCanal || 0,
            payoutFinalReal: valorHuespedIndividual - (reservaData.valores?.comision || reservaData.valores?.costoCanal || 0),
            valorPotencial,
            descuentoPotencialPct,
            abonoProporcional,
            saldo: valorHuespedIndividual - abonoProporcional,
            ajusteCobro,
            valorHuespedOriginal,
        },
        datosGrupo
    };
};
const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const { propiedadId, fechaLlegada, fechaSalida, personas, precioFinal, noches, nombre, email, telefono } = datosFormulario;

    // 1. Crear o encontrar al cliente
    const resultadoCliente = await crearOActualizarCliente(db, empresaId, { nombre, email, telefono });
    const clienteId = resultadoCliente.cliente.id;

    // 2. Obtener datos del canal por defecto
    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) throw new Error('No se encontró un canal por defecto para asignar la reserva.');
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalId = canalesSnapshot.docs[0].id;
    
    // 3. Obtener datos de la propiedad
    const propiedadDoc = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).get();
    if (!propiedadDoc.exists) throw new Error('La propiedad seleccionada ya no existe.');
    const propiedadData = propiedadDoc.data();

    // 4. Crear la reserva
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const nuevaReservaRef = reservasRef.doc();
    const idReservaCanal = `WEB-${nuevaReservaRef.id.substring(0, 8).toUpperCase()}`;

    const nuevaReserva = {
        id: nuevaReservaRef.id,
        idUnicoReserva: `${idReservaCanal}-${propiedadId}`,
        idReservaCanal: idReservaCanal,
        canalId: canalId,
        canalNombre: canalPorDefecto.nombre,
        clienteId: clienteId,
        alojamientoId: propiedadId,
        alojamientoNombre: propiedadData.nombre,
        fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
        fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
        totalNoches: parseInt(noches),
        cantidadHuespedes: parseInt(personas),
        estado: 'Confirmada',
        estadoGestion: 'Pendiente Bienvenida',
        origen: 'website',
        moneda: 'CLP',
        valores: {
            valorHuesped: parseFloat(precioFinal)
        },
        fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await nuevaReservaRef.set(nuevaReserva);
    return nuevaReserva;
};

module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    eliminarReserva,
    crearReservaPublica
};