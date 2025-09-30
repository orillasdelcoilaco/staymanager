const admin = require('firebase-admin');

const getReservasPendientes = async (db, empresaId) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');

    const queryGestion = reservasRef
        .where('estado', '==', 'Confirmada')
        .where('estadoGestion', 'in', ['Pendiente Bienvenida', 'Pendiente Cobro', 'Pendiente Pago', 'Pendiente Boleta', 'Pendiente Cliente']);

    const queryDesconocido = reservasRef.where('estado', '==', 'Desconocido');

    const [gestionSnapshot, desconocidoSnapshot] = await Promise.all([
        queryGestion.get(),
        queryDesconocido.get()
    ]);

    const allDocs = [];
    const docIds = new Set();

    gestionSnapshot.forEach(doc => { allDocs.push(doc); docIds.add(doc.id); });
    desconocidoSnapshot.forEach(doc => { if (!docIds.has(doc.id)) allDocs.push(doc); });

    if (allDocs.length === 0) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    allDocs.sort((a, b) => a.data().fechaLlegada.toDate() - b.data().fechaLlegada.toDate());

    const allReservasData = allDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const clienteIds = [...new Set(allReservasData.map(r => r.clienteId))];
    const reservaIdsOriginales = [...new Set(allReservasData.map(r => r.idReservaCanal))];

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        clienteIds.length > 0 ? db.collection('empresas').doc(empresaId).collection('clientes').where(admin.firestore.FieldPath.documentId(), 'in', clienteIds).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
    ]);

    const clientsMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const notesCountMap = new Map();
    notasSnapshot.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });
    const abonosMap = new Map();
    transaccionesSnapshot.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        abonosMap.set(id, (abonosMap.get(id) || 0) + (parseFloat(doc.data().monto) || 0));
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
                estado: data.estado,
                estadoGestion: data.estadoGestion,
                abonoTotal: abonosMap.get(reservaId) || 0,
                notasCount: notesCountMap.get(reservaId) || 0,
                transaccionesCount: transaccionesSnapshot.docs.filter(d => d.data().reservaIdOriginal === reservaId).length,
                reservasIndividuales: []
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values()).map(grupo => {
        const primerReserva = grupo.reservasIndividuales[0];
        const esUSD = primerReserva.moneda === 'USD';

        const valoresAgregados = grupo.reservasIndividuales.reduce((acc, r) => {
            acc.valorTotalHuesped += r.valores?.valorHuesped || 0;
            acc.costoCanal += (r.valores?.comision > 0 ? r.valores.comision : r.valores?.costoCanal || 0);
            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado) acc.potencialCalculado = true;
            if (r.clienteGestionado) acc.clienteGestionado = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };
            return acc;
        }, { valorTotalHuesped: 0, costoCanal: 0, ajusteManualRealizado: false, potencialCalculado: false, clienteGestionado: false, documentos: {} });
        
        const resultado = {
            ...grupo,
            ...valoresAgregados,
            esUSD,
            payoutFinalReal: valoresAgregados.valorTotalHuesped - valoresAgregados.costoCanal
        };

        if (esUSD) {
            const totalPayoutUSD = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.valorOriginal || 0), 0);
            const totalIvaUSD = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.iva || 0), 0);
            resultado.valoresUSD = {
                payout: totalPayoutUSD,
                iva: totalIvaUSD,
                totalCliente: totalPayoutUSD + totalIvaUSD
            };
        }

        return resultado;
    });
    
    return { grupos: gruposProcesados, hasMore: false, lastVisible: null };
};

// El resto de las funciones auxiliares no cambian
const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => { /* ...código existente... */ };
const getNotas = async (db, empresaId, reservaIdOriginal) => { /* ...código existente... */ };
const addNota = async (db, empresaId, notaData) => { /* ...código existente... */ };
const getTransacciones = async (db, empresaId, idsIndividuales) => { /* ...código existente... */ };
const marcarClienteComoGestionado = async (db, empresaId, reservaIdOriginal) => { /* ...código existente... */ };

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado
};