const admin = require('firebase-admin');

const getReservasPendientes = async (db, empresaId) => {
    console.log('--- [VERSIÓN FINAL] Petición a getReservasPendientes ---');
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');

    // Consulta 1: Flujo de gestión normal para reservas confirmadas.
    const queryGestion = reservasRef
        .where('estado', '==', 'Confirmada')
        .where('estadoGestion', 'in', ['Pendiente Bienvenida', 'Pendiente Cobro', 'Pendiente Pago', 'Pendiente Boleta', 'Pendiente Cliente']);

    // Consulta 2: Reservas que necesitan revisión manual.
    const queryDesconocido = reservasRef.where('estado', '==', 'Desconocido');

    const [gestionSnapshot, desconocidoSnapshot] = await Promise.all([
        queryGestion.get(),
        queryDesconocido.get()
    ]);

    const allDocs = [];
    const docIds = new Set();

    gestionSnapshot.forEach(doc => {
        if (!docIds.has(doc.id)) {
            allDocs.push(doc);
            docIds.add(doc.id);
        }
    });

    desconocidoSnapshot.forEach(doc => {
        if (!docIds.has(doc.id)) {
            allDocs.push(doc);
            docIds.add(doc.id);
        }
    });
    
    console.log(`[LOG 1] Documentos encontrados: ${allDocs.length} (Gestión: ${gestionSnapshot.size}, Desconocido: ${desconocidoSnapshot.size})`);

    if (allDocs.length === 0) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    allDocs.sort((a, b) => {
        const dateA = a.data().fechaLlegada.toDate();
        const dateB = b.data().fechaLlegada.toDate();
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return 0;
    });

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
                estado: data.estado,
                estadoGestion: data.estadoGestion,
                abonoTotal: abonosMap.get(reservaId) || 0,
                notasCount: notesCountMap.get(reservaId) || 0,
                transaccionesCount: transaccionesCountMap.get(reservaId) || 0,
                reservasIndividuales: []
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values());
    
    console.log(`[LOG 2] Grupos procesados y listos para enviar: ${gruposProcesados.length}`);
    if (gruposProcesados.length > 0) {
        console.log('[LOG 3] Muestra del primer grupo a enviar:', JSON.stringify(gruposProcesados[0], null, 2));
    }

    return {
        grupos: gruposProcesados,
        hasMore: false,
        lastVisible: null
    };
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