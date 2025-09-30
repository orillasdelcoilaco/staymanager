const admin = require('firebase-admin');

const getReservasPendientes = async (db, empresaId, lastVisibleData = null) => {
    const PAGE_SIZE = 20;
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');

    // Estrategia final: Consulta amplia y filtrado en servidor para evitar errores de índice.
    let query = reservasRef
        .where('estado', 'in', ['Confirmada', 'Desconocido'])
        .orderBy('fechaLlegada', 'asc')
        .orderBy(admin.firestore.FieldPath.documentId(), 'asc');

    if (lastVisibleData) {
        const lastDoc = await reservasRef.doc(lastVisibleData).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }
    
    // Traemos un poco más de documentos para asegurar que llenamos la página después de filtrar.
    query = query.limit(PAGE_SIZE * 2); 
    
    const snapshot = await query.get();

    if (snapshot.empty) {
        return { grupos: [], hasMore: false, lastVisible: null };
    }
    
    // Filtrado en el servidor:
    const estadosDeGestionPendientes = ['Pendiente Bienvenida', 'Pendiente Cobro', 'Pendiente Pago', 'Pendiente Boleta', 'Pendiente Cliente'];
    const docsFiltrados = snapshot.docs.filter(doc => {
        const data = doc.data();
        if (data.estado === 'Desconocido') {
            return true; // Siempre incluir las que necesitan revisión.
        }
        if (data.estado === 'Confirmada') {
            return estadosDeGestionPendientes.includes(data.estadoGestion); // Solo incluir confirmadas si están en el flujo.
        }
        return false;
    });

    const reservaDocs = docsFiltrados.slice(0, PAGE_SIZE);
    const hasMore = docsFiltrados.length > PAGE_SIZE;

    if (reservaDocs.length === 0) {
         return { grupos: [], hasMore: false, lastVisible: null };
    }

    const allReservasData = reservaDocs.map(doc => ({ id: doc.id, ...doc.data() }));

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
    
    const lastVisibleDocId = reservaDocs.length > 0 ? reservaDocs[reservaDocs.length - 1].id : null;

    return {
        grupos: gruposProcesados,
        hasMore: hasMore,
        lastVisible: lastVisibleDocId
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