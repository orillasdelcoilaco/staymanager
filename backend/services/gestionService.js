const admin = require('firebase-admin');
const { obtenerTarifaParaFecha } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');

function getTodayUTC() {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

const getReservasPendientes = async (db, empresaId) => {
    const [clientesSnapshot, reservasSnapshot, notasSnapshot, transaccionesSnapshot, tarifasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
        db.collection('empresas').doc(empresaId).collection('reservas').where('estado', '==', 'Confirmada').get(),
        db.collection('empresas').doc(empresaId).collection('gestionNotas').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get()
    ]);

    const clientsMap = new Map();
    clientesSnapshot.forEach(doc => clientsMap.set(doc.id, doc.data()));
    
    const notesCountMap = new Map();
    notasSnapshot.forEach(doc => {
        const nota = doc.data();
        const id = nota.reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });
    
    const transaccionesCountMap = new Map();
    const abonosMap = new Map();
    transaccionesSnapshot.forEach(doc => {
        const transaccion = doc.data();
        const id = transaccion.reservaIdOriginal;
        transaccionesCountMap.set(id, (transaccionesCountMap.get(id) || 0) + 1);
        
        const monto = parseFloat(transaccion.monto);
        if (!isNaN(monto)) {
            abonosMap.set(id, (abonosMap.get(id) || 0) + monto);
        }
    });

    const tarifas = tarifasSnapshot.docs.map(doc => doc.data());
    const reservasAgrupadas = new Map();

    for (const doc of reservasSnapshot.docs) {
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
                    fechaLlegada: (data.fechaLlegada && typeof data.fechaLlegada.toDate === 'function') ? data.fechaLlegada.toDate() : null,
                    fechaSalida: (data.fechaSalida && typeof data.fechaSalida.toDate === 'function') ? data.fechaSalida.toDate() : null,
                    estadoGestion: data.estadoGestion || 'Pendiente Bienvenida',
                    documentos: data.documentos || {},
                    reservasIndividuales: [],
                    valorTotalHuesped: 0,
                    costoCanal: 0,
                    payoutFinalReal: 0, // <-- Se calculará al final
                    ivaTotal: 0,
                    abonoTotal: abonosMap.get(reservaId) || 0,
                    potencialTotal: 0, 
                    valorListaBaseTotal: 0,
                    potencialCalculado: false,
                    totalNoches: 0,
                    valorTotalHuespedOriginal: 0,
                    ajusteManualRealizado: false,
                    notasCount: notesCountMap.get(reservaId) || 0,
                    transaccionesCount: transaccionesCountMap.get(reservaId) || 0
                });
            }

            const grupo = reservasAgrupadas.get(reservaId);
            const valorHuesped = data.valores?.valorHuesped || 0;
            const comisionReal = data.valores?.comision > 0 ? data.valores.comision : data.valores?.costoCanal || 0;
            const ivaIndividual = data.valores?.iva || 0;
            
            if (data.ajusteManualRealizado) {
                grupo.ajusteManualRealizado = true;
            }
            if (data.valores?.valorHuespedOriginal) {
                grupo.valorTotalHuespedOriginal += data.valores.valorHuespedOriginal;
            } else {
                grupo.valorTotalHuespedOriginal += valorHuesped;
            }
            
            const fechaLlegadaDate = (data.fechaLlegada && typeof data.fechaLlegada.toDate === 'function') ? data.fechaLlegada.toDate() : new Date();
            const tarifaAplicable = await obtenerTarifaParaFecha(db, empresaId, data.alojamientoId, data.canalId, fechaLlegadaDate);
            const valorListaBase = tarifaAplicable ? tarifaAplicable.valor : 0;

            grupo.reservasIndividuales.push({
                id: doc.id,
                alojamientoNombre: data.alojamientoNombre,
                canalNombre: data.canalNombre,
                moneda: data.moneda,
                valorDolarDia: data.valorDolarDia,
                valores: data.valores,
                valorListaBase: valorListaBase,
                totalNoches: data.totalNoches,
                cantidadHuespedes: data.cantidadHuespedes
            });
            
            grupo.valorTotalHuesped += valorHuesped;
            grupo.costoCanal += comisionReal;
            grupo.ivaTotal += ivaIndividual;
            const noches = data.totalNoches || 1;
            grupo.valorListaBaseTotal += (valorListaBase * noches);
            if (grupo.totalNoches === 0) {
                grupo.totalNoches = noches;
            }
            
            if (data.valores?.valorPotencial && data.valores.valorPotencial > 0) {
                grupo.potencialTotal += data.valores.valorPotencial;
                grupo.potencialCalculado = true;
            }

            if (data.documentos) {
                 grupo.documentos = {...grupo.documentos, ...data.documentos};
            }
        }
    }
    
    // --- INICIO DE CAMBIOS ---
    // Calcular el Payout Final Real después de haber sumado todos los valores
    for (const grupo of reservasAgrupadas.values()) {
        grupo.payoutFinalReal = grupo.valorTotalHuesped - grupo.costoCanal;
    }
    // --- FIN DE CAMBIOS ---

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