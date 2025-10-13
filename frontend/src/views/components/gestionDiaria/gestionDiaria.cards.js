// backend/services/gestionService.js

const admin = require('firebase-admin');

const getReservasPendientes = async (db, empresaId) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    // CAMBIO: Obtener dinámicamente los estados de gestión desde la nueva colección
    const estadosSnapshot = await db.collection('empresas').doc(empresaId).collection('estadosReserva').where('esEstadoDeGestion', '==', true).get();
    const estadosDeGestion = estadosSnapshot.docs.map(doc => doc.data().nombre);

    const queries = [];
    if (estadosDeGestion.length > 0) {
        queries.push(
            reservasRef
                .where('estado', '==', 'Confirmada')
                .where('estadoGestion', 'in', estadosDeGestion)
                .get()
        );
    }
    queries.push(reservasRef.where('estado', '==', 'Desconocido').get());

    const snapshots = await Promise.all(queries);
    const [gestionSnapshot, desconocidoSnapshot] = snapshots;

    const allDocs = [];
    const docIds = new Set();

    if(gestionSnapshot) {
        gestionSnapshot.forEach(doc => { allDocs.push(doc); docIds.add(doc.id); });
    }
    if (desconocidoSnapshot) {
        desconocidoSnapshot.forEach(doc => { if (!docIds.has(doc.id)) allDocs.push(doc); });
    }

    if (allDocs.length === 0) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    allDocs.sort((a, b) => a.data().fechaLlegada.toDate() - b.data().fechaLlegada.toDate());

    const allReservasData = allDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const clienteIds = [...new Set(allReservasData.map(r => r.clienteId).filter(Boolean))];
    const reservaIdsOriginales = [...new Set(allReservasData.map(r => r.idReservaCanal))];

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot, historialReservasSnapshot] = await Promise.all([
        clienteIds.length > 0 ? db.collection('empresas').doc(empresaId).collection('clientes').where(admin.firestore.FieldPath.documentId(), 'in', clienteIds).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        clienteIds.length > 0 ? db.collection('empresas').doc(empresaId).collection('reservas').where('clienteId', 'in', clienteIds).where('estado', '==', 'Confirmada').get() : Promise.resolve({ docs: [] })
    ]);

    const clientsMap = new Map();
    clientesSnapshot.docs.forEach(doc => {
        const clienteData = doc.data();
        const historialCliente = historialReservasSnapshot.docs
            .filter(reservaDoc => reservaDoc.data().clienteId === doc.id)
            .map(reservaDoc => reservaDoc.data());

        const totalGastado = historialCliente.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0);
        const numeroDeReservas = historialCliente.length;
        
        let tipoCliente = 'Cliente Nuevo';
        if (totalGastado > 1000000) {
            tipoCliente = 'Cliente Premium';
        } else if (numeroDeReservas > 1) {
            tipoCliente = 'Cliente Frecuente';
        }

        clientsMap.set(doc.id, {
            ...clienteData,
            numeroDeReservas,
            tipoCliente
        });
    });
    
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
                tipoCliente: clienteActual?.tipoCliente || 'Nuevo',
                numeroDeReservas: clienteActual?.numeroDeReservas || 1,
                fechaLlegada: data.fechaLlegada?.toDate(),
                fechaSalida: data.fechaSalida?.toDate(),
                totalNoches: data.totalNoches,
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
            acc.valorListaBaseTotal += r.valores?.valorOriginal || 0;
            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado) acc.potencialCalculado = true;
            if (r.clienteGestionado) acc.clienteGestionado = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };
            return acc;
        }, { valorTotalHuesped: 0, costoCanal: 0, valorListaBaseTotal: 0, ajusteManualRealizado: false, potencialCalculado: false, clienteGestionado: false, documentos: {} });
        
        const resultado = {
            ...grupo,
            ...valoresAgregados,
            esUSD,
            payoutFinalReal: valoresAgregados.valorTotalHuesped - valoresAgregados.costoCanal
        };

        if (esUSD) {
            const valorDolarDia = primerReserva.valorDolarDia || 1;
            const totalPayoutUSD = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.valorOriginal || 0), 0);
            const totalIvaCLP = grupo.reservasIndividuales.reduce((sum, r) => sum + (r.valores?.iva || 0), 0);
            const totalIvaUSD = valorDolarDia > 0 ? totalIvaCLP / valorDolarDia : 0;
            
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


const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => {
    const batch = db.batch();
    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, { estadoGestion: nuevoEstado });
    });
    await batch.commit();
};

const getNotas = async (db, empresaId, reservaIdOriginal) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('gestionNotas')
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .orderBy('fecha', 'desc')
        .get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, fecha: doc.data().fecha.toDate().toLocaleString('es-CL') }));
};

const addNota = async (db, empresaId, notaData) => {
    const nota = { ...notaData, fecha: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('empresas').doc(empresaId).collection('gestionNotas').add(nota);
    return { id: docRef.id, ...nota };
};

const getTransacciones = async (db, empresaId, idsIndividuales) => {
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const reservaDoc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]).get();
    if (!reservaDoc.exists) return [];
    
    const reservaIdOriginal = reservaDoc.data().idReservaCanal;
    
    const snapshot = await transaccionesRef
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .get();

    if (snapshot.empty) return [];

    const transacciones = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fecha: data.fecha ? data.fecha.toDate() : new Date()
        };
    });
    transacciones.sort((a, b) => b.fecha - a.fecha);
    return transacciones;
};

const marcarClienteComoGestionado = async (db, empresaId, reservaIdOriginal) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const q = reservasRef.where('idReservaCanal', '==', reservaIdOriginal);
    const snapshot = await q.get();

    if (snapshot.empty) {
        throw new Error('No se encontraron reservas para marcar al cliente como gestionado.');
    }

    const batch = db.batch();
    let estadoActual = '';
    snapshot.forEach(doc => {
        estadoActual = doc.data().estadoGestion;
        const updateData = { clienteGestionado: true };
        if (estadoActual === 'Pendiente Cliente') {
            updateData.estadoGestion = 'Facturado';
        }
        batch.update(doc.ref, updateData);
    });
    
    await batch.commit();
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado
};