const admin = require('firebase-admin');

function getTodayUTC() {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

const getReservasPendientes = async (db, empresaId) => {
    const [clientesSnapshot, reservasSnapshot, notasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('estado', '==', 'Confirmada')
            .get(),
        db.collection('empresas').doc(empresaId).collection('gestionNotas').get()
    ]);

    const clientsMap = new Map();
    clientesSnapshot.forEach(doc => {
        clientsMap.set(doc.id, doc.data());
    });
    
    const notesCountMap = new Map();
    notasSnapshot.forEach(doc => {
        const nota = doc.data();
        const id = nota.reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });

    const reservasAgrupadas = new Map();

    reservasSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.estadoGestion !== 'Facturado') {
            const reservaId = data.idReservaCanal;

            if (!reservasAgrupadas.has(reservaId)) {
                const clienteActual = clientsMap.get(data.clienteId);
                
                reservasAgrupadas.set(reservaId, {
                    reservaIdOriginal: reservaId,
                    clienteId: data.clienteId,
                    clienteNombre: clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido', // <-- CORRECCIÓN APLICADA AQUÍ
                    telefono: clienteActual?.telefono || data.telefono || 'N/A',
                    fechaLlegada: data.fechaLlegada ? data.fechaLlegada.toDate() : null,
                    fechaSalida: data.fechaSalida ? data.fechaSalida.toDate() : null,
                    estadoGestion: data.estadoGestion || 'Pendiente Bienvenida',
                    documentos: data.documentos || {},
                    reservasIndividuales: [],
                    valorTotalCLP: 0,
                    abonoTotal: 0,
                    potencialTotal: 0,
                    potencialCalculado: false,
                    notasCount: notesCountMap.get(reservaId) || 0
                });
            }

            const grupo = reservasAgrupadas.get(reservaId);
            
            grupo.reservasIndividuales.push({
                id: doc.id,
                alojamientoNombre: data.alojamientoNombre,
                valorCLP: data.valores?.valorTotal || 0,
                abono: data.valores?.abono || 0,
            });

            grupo.valorTotalCLP += data.valores?.valorTotal || 0;
            grupo.abonoTotal += data.valores?.abono || 0;
            
            if (data.valores?.valorPotencial && data.valores.valorPotencial > 0) {
                grupo.potencialTotal += data.valores.valorPotencial;
                grupo.potencialCalculado = true;
            }
        }
    });

    const reservas = Array.from(reservasAgrupadas.values());
    const today = getTodayUTC();

    const priorityOrder = {
        'Pendiente Pago': 1, 'Pendiente Boleta': 2, 'Pendiente Cobro': 3, 'Pendiente Bienvenida': 4
    };
    
    reservas.sort((a, b) => {
        const aLlegaHoy = a.fechaLlegada && a.fechaLlegada.getTime() <= today.getTime();
        const bLlegaHoy = b.fechaLlegada && b.fechaLlegada.getTime() <= today.getTime();

        if (aLlegaHoy && !bLlegaHoy) return -1;
        if (!aLlegaHoy && bLlegaHoy) return 1;

        if (aLlegaHoy && bLlegaHoy) {
            const priorityA = priorityOrder[a.estadoGestion] || 99;
            const priorityB = priorityOrder[b.estadoGestion] || 99;
            if (priorityA !== priorityB) return priorityA - priorityB;
        }
        
        return (a.fechaLlegada || 0) - (b.fechaLlegada || 0);
    });

    return reservas;
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
    let todasLasTransacciones = [];
    for (const id of idsIndividuales) {
        const transaccionesRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(id).collection('transacciones');
        const snapshot = await transaccionesRef.get();
        snapshot.forEach(doc => {
            const data = doc.data();
            todasLasTransacciones.push({
                reservaIndividualId: id,
                id: doc.id,
                ...data,
                fecha: data.fecha ? data.fecha.toDate() : new Date()
            });
        });
    }
    todasLasTransacciones.sort((a, b) => b.fecha - a.fecha);
    return todasLasTransacciones;
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones
};