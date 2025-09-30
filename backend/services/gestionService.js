const admin = require('firebase-admin');

function findTarifaInMemory(tarifas, alojamientoId, canalId, fecha) {
    const tarifa = tarifas.find(t =>
        t.alojamientoId === alojamientoId &&
        new Date(t.fechaInicio) <= fecha &&
        new Date(t.fechaTermino) >= fecha
    );
    // Aseguramos que si encontramos una tarifa, tenga precios definidos.
    if (tarifa && tarifa.precios && tarifa.precios[canalId]) {
        return tarifa.precios[canalId];
    }
    return null;
}

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

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot, tarifasSnapshot] = await Promise.all([
        clienteIds.length > 0 ? db.collection('empresas').doc(empresaId).collection('clientes').where(admin.firestore.FieldPath.documentId(), 'in', clienteIds).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        reservaIdsOriginales.length > 0 ? db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', 'in', reservaIdsOriginales).get() : Promise.resolve({ docs: [] }),
        db.collection('empresas').doc(empresaId).collection('tarifas').orderBy('fechaInicio', 'desc').get()
    ]);

    const clientsMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const todasLasTarifas = tarifasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
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
                totalNoches: data.totalNoches,
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

        let valorListaBaseTotal = 0;
        grupo.reservasIndividuales.forEach(r => {
            const tarifaPrecio = findTarifaInMemory(todasLasTarifas, r.alojamientoId, r.canalId, r.fechaLlegada.toDate());
            if (tarifaPrecio) {
                valorListaBaseTotal += tarifaPrecio.valor * r.totalNoches;
            }
        });

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
            valorListaBaseTotal,
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