const admin = require('firebase-admin');

function getTodayUTC() {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

const getReservasPendientes = async (db, empresaId, lastVisibleData = null) => {
    console.log('--- Nueva Petición a getReservasPendientes ---');
    console.log('Recibiendo cursor:', lastVisibleData);

    const PAGE_SIZE = 20;

    let query = db.collection('empresas').doc(empresaId).collection('reservas')
        .where('estado', '==', 'Confirmada')
        .where('estadoGestion', 'in', ['Pendiente Bienvenida', 'Pendiente Cobro', 'Pendiente Pago', 'Pendiente Boleta', 'Pendiente Cliente'])
        .orderBy('fechaLlegada', 'asc')
        .orderBy('estadoGestion', 'asc');

    if (lastVisibleData) {
        query = query.startAfter(admin.firestore.Timestamp.fromDate(new Date(lastVisibleData.fechaLlegada)), lastVisibleData.estadoGestion);
    }
    
    query = query.limit(PAGE_SIZE);
    
    const reservasSnapshot = await query.get();
    console.log(`Documentos de reserva encontrados: ${reservasSnapshot.size}`);

    if (reservasSnapshot.empty) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    const reservaDocs = reservasSnapshot.docs;
    const allReservasData = reservaDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const clienteIds = [...new Set(allReservasData.map(r => r.clienteId))];
    const reservaIdsOriginales = [...new Set(allReservasData.map(r => r.idReservaCanal))];

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot, tarifasSnapshot] = await Promise.all([
        clienteIds.length > 0 ? db.collection('empresas').doc(empresaId).collection('clientes').where(admin.firestore.FieldPath.documentId(), 'in', clienteIds).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        db.collection('empresas').doc(empresaId).collection('tarifas').orderBy('fechaInicio', 'desc').get()
    ]);

    const clientsMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const todasLasTarifas = tarifasSnapshot.docs.map(doc => doc.data());
    
    const notesCountMap = new Map();
    notasSnapshot.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });

    const transaccionesCountMap = new Map();
    const abonosMap = new Map();
    transaccionesSnapshot.forEach(doc => {
        const data = doc.data();
        const id = data.reservaIdOriginal;
        transaccionesCountMap.set(id, (transaccionesCountMap.get(id) || 0) + 1);
        const monto = parseFloat(data.monto);
        if (!isNaN(monto)) {
            abonosMap.set(id, (abonosMap.get(id) || 0) + monto);
        }
    });

    const reservasAgrupadas = new Map();

    allReservasData.forEach(data => {
        const reservaId = data.idReservaCanal;
        if (!reservasAgrupadas.has(reservaId)) {
            const clienteActual = clientsMap.get(data.clienteId);
            reservasAgrupadas.set(reservaId, {
                reservaIdOriginal: reservaId,
                clienteId: data.clienteId,
                clienteNombre: clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
                telefono: clienteActual?.telefono || 'N/A',
                fechaLlegada: data.fechaLlegada?.toDate(),
                fechaSalida: data.fechaSalida?.toDate(),
                estadoGestion: data.estadoGestion || 'Pendiente Bienvenida',
                abonoTotal: abonosMap.get(reservaId) || 0,
                notasCount: notesCountMap.get(reservaId) || 0,
                transaccionesCount: transaccionesCountMap.get(reservaId) || 0,
                reservasIndividuales: []
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values()).map(grupo => {
        // ... (código interno de procesamiento sin cambios)
        const primerReserva = grupo.reservasIndividuales[0];
        const esUSD = primerReserva.moneda === 'USD';
        
        const valoresAgregados = grupo.reservasIndividuales.reduce((acc, r) => {
            const valorHuesped = r.valores?.valorHuesped || 0;
            const comisionReal = r.valores?.comision > 0 ? r.valores.comision : r.valores?.costoCanal || 0;

            acc.valorTotalHuesped += valorHuesped;
            acc.costoCanal += comisionReal;

            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado) acc.potencialCalculado = true;
            if (r.clienteGestionado) acc.clienteGestionado = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };

            return acc;
        }, {
            valorTotalHuesped: 0, costoCanal: 0,
            ajusteManualRealizado: false, potencialCalculado: false, clienteGestionado: false,
            documentos: {}
        });

        return {
            ...grupo,
            ...valoresAgregados,
            esUSD,
            payoutFinalReal: valoresAgregados.valorTotalHuesped - valoresAgregados.costoCanal
        };
    });
    
    const lastVisibleDoc = reservaDocs[reservaDocs.length - 1]?.data();
    const nuevoCursor = lastVisibleDoc ? {
        fechaLlegada: lastVisibleDoc.fechaLlegada.toDate().toISOString(),
        estadoGestion: lastVisibleDoc.estadoGestion
    } : null;
    
    console.log('Enviando nuevo cursor:', nuevoCursor);

    return {
        grupos: gruposProcesados,
        hasMore: reservaDocs.length === PAGE_SIZE,
        lastVisible: nuevoCursor
    };
};

const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => {
    // ... (código sin cambios)
};

const getNotas = async (db, empresaId, reservaIdOriginal) => {
    // ... (código sin cambios)
};

const addNota = async (db, empresaId, notaData) => {
    // ... (código sin cambios)
};

const getTransacciones = async (db, empresaId, idsIndividuales) => {
    // ... (código sin cambios)
};

const marcarClienteComoGestionado = async (db, empresaId, reservaIdOriginal) => {
    // ... (código sin cambios)
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado
};