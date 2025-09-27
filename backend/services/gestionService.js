const admin = require('firebase-admin');
const { obtenerTarifaParaFecha } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');

function getTodayUTC() {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

const getReservasPendientes = async (db, empresaId) => {
    const [clientesSnapshot, reservasSnapshot, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('estado', '==', 'Confirmada')
            .get(),
        db.collection('empresas').doc(empresaId).collection('gestionNotas').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').get()
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
    
    const transaccionesCountMap = new Map();
    transaccionesSnapshot.forEach(doc => {
        const transaccion = doc.data();
        const id = transaccion.reservaIdOriginal;
        transaccionesCountMap.set(id, (transaccionesCountMap.get(id) || 0) + 1);
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
                    clienteNombre: clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
                    telefono: clienteActual?.telefono || data.telefono || 'N/A',
                    // --- INICIO DE LA CORRECCIÓN ---
                    // Se verifica que el campo sea un Timestamp antes de llamar a .toDate()
                    fechaLlegada: (data.fechaLlegada && typeof data.fechaLlegada.toDate === 'function') ? data.fechaLlegada.toDate() : null,
                    fechaSalida: (data.fechaSalida && typeof data.fechaSalida.toDate === 'function') ? data.fechaSalida.toDate() : null,
                    // --- FIN DE LA CORRECCIÓN ---
                    estadoGestion: data.estadoGestion || 'Pendiente Bienvenida',
                    documentos: data.documentos || {},
                    reservasIndividuales: [],
                    valorTotalHuesped: 0,
                    valorTotalPayout: 0,
                    costoCanal: 0,
                    abonoTotal: 0,
                    potencialTotal: 0,
                    potencialCalculado: false,
                    notasCount: notesCountMap.get(reservaId) || 0,
                    transaccionesCount: transaccionesCountMap.get(reservaId) || 0
                });
            }

            const grupo = reservasAgrupadas.get(reservaId);
            const valorHuesped = data.valores?.valorHuesped || data.valores?.valorTotal || 0;
            const valorPayout = data.valores?.valorTotal || 0;
            
            grupo.reservasIndividuales.push({
                id: doc.id,
                alojamientoNombre: data.alojamientoNombre,
                valorHuesped: valorHuesped,
                valorPayout: valorPayout,
            });

            grupo.valorTotalHuesped += valorHuesped;
            grupo.valorTotalPayout += valorPayout;
            grupo.costoCanal += (valorHuesped - valorPayout);
            grupo.abonoTotal += data.valores?.abono || 0;
            
            if (data.valores?.valorPotencial && data.valores.valorPotencial > 0) {
                grupo.potencialTotal += data.valores.valorPotencial;
                grupo.potencialCalculado = true;
            }
            if (data.documentos) {
                 grupo.documentos = {...grupo.documentos, ...data.documentos};
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
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const reservaIdOriginal = (await db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]).get()).data().idReservaCanal;
    
    const snapshot = await transaccionesRef
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .orderBy('fecha', 'desc')
        .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fecha: data.fecha ? data.fecha.toDate() : new Date()
        };
    });
};

const getAnalisisFinanciero = async (db, empresaId, grupoReserva) => {
    const idReservaPrincipal = grupoReserva.reservasIndividuales[0].id;
    const reservaPrincipalSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idReservaPrincipal).get();
    if (!reservaPrincipalSnapshot.exists) throw new Error("La reserva principal del grupo no fue encontrada.");
    
    const reservaPrincipal = reservaPrincipalSnapshot.data();
    const { canalId, alojamientoId, fechaLlegada } = reservaPrincipal;

    const tarifaBase = await obtenerTarifaParaFecha(db, empresaId, alojamientoId, canalId, fechaLlegada.toDate());
    const valorLista = tarifaBase ? tarifaBase.valor : 0;
    const moneda = tarifaBase ? tarifaBase.moneda : 'CLP';

    const valorHuespedTotal = grupoReserva.valorTotalHuesped;
    const valorPayoutTotal = grupoReserva.valorTotalPayout;
    
    const descuentos = valorLista > 0 ? (valorLista * grupoReserva.reservasIndividuales.length) - valorHuespedTotal : 0;
    const costoCanal = valorHuespedTotal - valorPayoutTotal;

    let valorDolarDia = null;
    if (moneda === 'USD') {
        valorDolarDia = await obtenerValorDolar(db, empresaId, fechaLlegada.toDate());
    }

    return {
        valorLista: valorLista * grupoReserva.reservasIndividuales.length,
        descuentos: descuentos > 0 ? descuentos : 0,
        costoCanal: costoCanal,
        payout: valorPayoutTotal,
        moneda,
        valorDolarDia,
    };
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    getAnalisisFinanciero
};