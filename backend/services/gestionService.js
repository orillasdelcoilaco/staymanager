const admin = require('firebase-admin');
const { obtenerTarifaParaFecha } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');

function getTodayUTC() {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

const getReservasPendientes = async (db, empresaId) => {
    const [clientesSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('estado', '==', 'Confirmada')
            .where('estadoGestion', '!=', 'Facturado')
            .get()
    ]);

    const clientsMap = new Map();
    clientesSnapshot.forEach(doc => {
        clientsMap.set(doc.id, doc.data());
    });
    
    if (reservasSnapshot.empty) {
        return [];
    }

    const reservasAgrupadas = new Map();
    const idsDeReservasOriginales = new Set();

    reservasSnapshot.docs.forEach(doc => {
        // --- INICIO DE LA CORRECCIÓN ---
        try {
            const data = doc.data();

            // Validar que los datos esenciales existan y sean correctos
            if (!data.idReservaCanal || !data.fechaLlegada || !data.fechaSalida || typeof data.fechaLlegada.toDate !== 'function' || typeof data.fechaSalida.toDate !== 'function') {
                console.warn(`[Gestión Diaria] Omitiendo reserva ${doc.id} por datos incompletos o malformados.`);
                return; // Ignora esta reserva y continúa con la siguiente
            }

            const reservaId = data.idReservaCanal;
            idsDeReservasOriginales.add(reservaId);

            if (!reservasAgrupadas.has(reservaId)) {
                const clienteActual = clientsMap.get(data.clienteId);
                reservasAgrupadas.set(reservaId, {
                    reservaIdOriginal: reservaId,
                    clienteId: data.clienteId,
                    clienteNombre: clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
                    telefono: clienteActual?.telefono || data.telefono || 'N/A',
                    fechaLlegada: data.fechaLlegada.toDate(),
                    fechaSalida: data.fechaSalida.toDate(),
                    estadoGestion: data.estadoGestion || 'Pendiente Bienvenida',
                    documentos: data.documentos || {},
                    reservasIndividuales: [],
                    valorTotalHuesped: 0,
                    valorTotalPayout: 0,
                    costoCanal: 0,
                    abonoTotal: 0,
                    potencialTotal: 0,
                    potencialCalculado: false,
                    notasCount: 0,
                    transaccionesCount: 0
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
        } catch (error) {
            console.error(`[Gestión Diaria] Error procesando la reserva ${doc.id}. Será omitida. Error:`, error.message);
        }
        // --- FIN DE LA CORRECCIÓN ---
    });

    const idsArray = Array.from(idsDeReservasOriginales);
    if (idsArray.length > 0) {
        const chunkSize = 30;
        const chunks = [];
        for (let i = 0; i < idsArray.length; i += chunkSize) {
            chunks.push(idsArray.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
            const [notasSnapshot, transaccionesSnapshot] = await Promise.all([
                db.collection('empresas').doc(empresaId).collection('gestionNotas')
                  .where('reservaIdOriginal', 'in', chunk).get(),
                db.collection('empresas').doc(empresaId).collection('transacciones')
                  .where('reservaIdOriginal', 'in', chunk).get()
            ]);

            notasSnapshot.forEach(doc => {
                const id = doc.data().reservaIdOriginal;
                if (reservasAgrupadas.has(id)) {
                    reservasAgrupadas.get(id).notasCount++;
                }
            });

            transaccionesSnapshot.forEach(doc => {
                const id = doc.data().reservaIdOriginal;
                if (reservasAgrupadas.has(id)) {
                    reservasAgrupadas.get(id).transaccionesCount++;
                }
            });
        }
    }

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

    const fechaLlegadaDate = (fechaLlegada && typeof fechaLlegada.toDate === 'function') ? fechaLlegada.toDate() : null;
    if (!fechaLlegadaDate) throw new Error("La fecha de llegada de la reserva principal es inválida.");

    const tarifaBase = await obtenerTarifaParaFecha(db, empresaId, alojamientoId, canalId, fechaLlegadaDate);
    const valorLista = tarifaBase ? tarifaBase.valor : 0;
    const moneda = tarifaBase ? tarifaBase.moneda : 'CLP';

    const valorHuespedTotal = grupoReserva.valorTotalHuesped;
    const valorPayoutTotal = grupoReserva.valorTotalPayout;
    
    const descuentos = valorLista > 0 ? (valorLista * grupoReserva.reservasIndividuales.length) - valorHuespedTotal : 0;
    const costoCanal = valorHuespedTotal - valorPayoutTotal;

    let valorDolarDia = null;
    if (moneda === 'USD') {
        valorDolarDia = await obtenerValorDolar(db, empresaId, fechaLlegadaDate);
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