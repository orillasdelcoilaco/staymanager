// backend/services/reservasService.js

const admin = require('firebase-admin');
const { obtenerValorDolarHoy } = require('./dolarService');

const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    let q = reservasRef.where('idUnicoReserva', '==', datosReserva.idUnicoReserva);
    let snapshot = await q.get();

    if (snapshot.empty) {
        const qIcal = reservasRef
            .where('alojamientoId', '==', datosReserva.alojamientoId)
            .where('origen', '==', 'ical')
            .where('estado', '==', 'Propuesta')
            .where('fechaLlegada', '<=', admin.firestore.Timestamp.fromDate(datosReserva.fechaLlegada))
            .where('fechaSalida', '>=', admin.firestore.Timestamp.fromDate(datosReserva.fechaLlegada));
        
        snapshot = await qIcal.get();
    }

    if (snapshot.empty) {
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = { id: nuevaReservaRef.id, ...datosReserva, fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), edicionesManuales: {} };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        const reservaDoc = snapshot.docs[0];
        const reservaExistente = reservaDoc.data();
        const ediciones = reservaExistente.edicionesManuales || {};
        
        let hayCambios = false;
        const datosAActualizar = {};

        if (reservaExistente.origen === 'ical') {
            datosAActualizar.idUnicoReserva = datosReserva.idUnicoReserva;
            datosAActualizar.idReservaCanal = datosReserva.idReservaCanal;
            datosAActualizar.origen = 'reporte';
            hayCambios = true;
        }

        const nuevosValores = { ...reservaExistente.valores, ...datosReserva.valores };
        for (const key in datosReserva.valores) {
            if (!ediciones[`valores.${key}`]) {
                if (nuevosValores[key] !== datosReserva.valores[key]) {
                    hayCambios = true;
                }
            }
        }
        datosAActualizar.valores = nuevosValores;

        const camposSimples = ['moneda', 'estado', 'alojamientoId', 'fechaLlegada', 'fechaSalida', 'clienteId', 'estadoGestion'];
        camposSimples.forEach(campo => {
            if (!ediciones[campo] && datosReserva[campo] !== undefined && JSON.stringify(reservaExistente[campo]) !== JSON.stringify(datosReserva[campo])) {
                datosAActualizar[campo] = datosReserva[campo];
                hayCambios = true;
            }
        });
        
        if (datosReserva.idCarga && reservaExistente.idCarga !== datosReserva.idCarga) {
            datosAActualizar.idCarga = datosReserva.idCarga;
            hayCambios = true;
        }

        if (hayCambios) {
            datosAActualizar.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();
            await reservaDoc.ref.update(datosAActualizar);
            const dataActualizada = { ...reservaExistente, ...datosAActualizar };
            return { reserva: dataActualizada, status: 'actualizada' };
        } else {
            return { reserva: reservaExistente, status: 'sin_cambios' };
        }
    }
};

const actualizarReservaManualmente = async (db, empresaId, reservaId, datosNuevos) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) throw new Error('La reserva no existe.');
    
    const reservaExistente = reservaDoc.data();
    const edicionesManuales = reservaExistente.edicionesManuales || {};

    if (datosNuevos.fechaLlegada) datosNuevos.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada + 'T00:00:00Z'));
    if (datosNuevos.fechaSalida) datosNuevos.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida + 'T00:00:00Z'));

    // --- INICIO DE LA MODIFICACIÓN: LÓGICA DE CONGELACIÓN (Facturación) ---
    // Si el nuevo estado es 'Facturado' Y la reserva no estaba ya 'Facturada'
    if (datosNuevos.estadoGestion === 'Facturado' && reservaExistente.estadoGestion !== 'Facturado') {
        const moneda = reservaExistente.moneda || 'CLP';
        
        // Solo aplicar si la moneda no es CLP y tiene valores originales
        if (moneda !== 'CLP' && reservaExistente.valores?.valorHuespedOriginal > 0) {
            
            // 1. Obtener el valor del dólar de HOY
            const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
            const valorDolarFacturacion = dolarHoyData ? dolarHoyData.valor : 950; // Usar fallback
            
            // 2. Obtener los valores originales (USD)
            const valorHuespedOriginal = reservaExistente.valores.valorHuespedOriginal || 0;
            const costoCanalOriginal = reservaExistente.valores.comisionOriginal || reservaExistente.valores.costoCanalOriginal || 0;
            
            // 3. Calcular los valores CLP "congelados"
            const valorHuespedCLPCongelado = Math.round(valorHuespedOriginal * valorDolarFacturacion);
            const costoCanalCLPCongelado = Math.round(costoCanalOriginal * valorDolarFacturacion);
            
            // 4. Inyectar estos valores en el objeto que se va a guardar
            // Nos aseguramos de que 'valores' exista en datosNuevos
            if (!datosNuevos.valores) {
                datosNuevos.valores = {};
            }
            
            datosNuevos.valores.valorHuesped = valorHuespedCLPCongelado;
            datosNuevos.valores.comision = costoCanalCLPCongelado;
            datosNuevos.valores.valorDolarFacturacion = valorDolarFacturacion;
            
            // 5. Marcar estos campos como 'editados' (protegidos)
            edicionesManuales['valores.valorHuesped'] = true;
            edicionesManuales['valores.comision'] = true;
            edicionesManuales['valores.valorDolarFacturacion'] = true;
        }
    }
    // --- FIN DE LA MODIFICACIÓN ---

    Object.keys(datosNuevos).forEach(key => {
        const valorNuevo = datosNuevos[key];
        const valorExistente = reservaExistente[key];
        if (typeof valorNuevo === 'object' && valorNuevo !== null && !Array.isArray(valorNuevo)) {
            Object.keys(valorNuevo).forEach(subKey => {
                if (JSON.stringify(valorExistente?.[subKey]) !== JSON.stringify(valorNuevo[subKey])) {
                    edicionesManuales[`${key}.${subKey}`] = true;
                }
            });
        } else if (JSON.stringify(valorExistente) !== JSON.stringify(valorNuevo)) {
            edicionesManuales[key] = true;
        }
    });

    const datosAActualizar = { ...datosNuevos, edicionesManuales, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() };
    await reservaRef.update(datosAActualizar);
    return { id: reservaId, ...datosAActualizar };
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    
    // --- INICIO DE LA MODIFICACIÓN 1: Obtener Dólar Hoy (una vez) ---
    const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
    const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950; // Fallback
    // --- FIN DE LA MODIFICACIÓN 1 ---

    const [reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    if (reservasSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    return reservasSnapshot.docs.map(doc => {
        const data = doc.data(); // Obtenemos los datos de la reserva
        const cliente = clientesMap.get(data.clienteId);

        // --- INICIO DE LA MODIFICACIÓN 2: Lógica Flotante ---
        const moneda = data.moneda || 'CLP';
        
        // Solo recalcular si es moneda extranjera Y NO está Facturado
        if (moneda !== 'CLP' && data.estadoGestion !== 'Facturado') {
            const valorHuespedOriginal = data.valores?.valorHuespedOriginal || 0;
            const costoCanalOriginal = data.valores?.comisionOriginal || data.valores?.costoCanalOriginal || 0;
            
            if (valorHuespedOriginal > 0) {
                // Asegurarnos de que 'valores' exista
                if (!data.valores) data.valores = {};
                
                // Sobreescribir los valores CLP estáticos con los flotantes
                data.valores.valorHuesped = Math.round(valorHuespedOriginal * valorDolarHoy);
                
                // (Opcional, pero recomendado) Sobreescribir también la comisión/costo
                const comisionRecalculada = Math.round(costoCanalOriginal * valorDolarHoy);
                data.valores.comision = comisionRecalculada;
                data.valores.costoCanal = comisionRecalculada;
            }
        }
        // --- FIN DE LA MODIFICACIÓN 2 ---

        // Devolvemos el objeto 'data' modificado
        return {
            ...data,
            id: doc.id,
            telefono: cliente ? cliente.telefono : 'N/A',
            nombreCliente: cliente ? cliente.nombre : 'Cliente no encontrado',
            fechaLlegada: data.fechaLlegada?.toDate().toISOString() || null,
            fechaSalida: data.fechaSalida?.toDate().toISOString() || null,
            fechaCreacion: data.fechaCreacion?.toDate().toISOString() || null,
            fechaActualizacion: data.fechaActualizacion?.toDate().toISOString() || null,
            fechaReserva: data.fechaReserva?.toDate().toISOString() || null
        };
    });
};

const obtenerReservaPorId = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const doc = await reservaRef.get();
    if (!doc.exists) {
        throw new Error('Reserva no encontrada');
    }
    const reservaData = doc.data();
    
    const idReservaOriginal = reservaData.idReservaCanal;

    if (!idReservaOriginal) {
       if (reservaData.origen === 'ical' && !reservaData.clienteId) {
            console.warn(`Reserva iCal ${reservaId} no tiene idReservaCanal. Devolviendo datos parciales.`);
            return {
// ... (código de iCal sin cambios) ...
                ...reservaData,
                fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
                fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
                fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
                cliente: {},
                notas: [],
                transacciones: [],
                datosIndividuales: { 
                    valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, 
                    valorPotencial: 0, descuentoPotencialPct: 0, abonoProporcional: 0, 
                    saldo: 0, ajusteCobro: 0, 
                    valorHuespedOriginal: 0, 
                    costoCanalOriginal: 0, 
                    valorTotalOriginal: 0, // Payout
                    ivaOriginal: 0,
                    moneda: reservaData.moneda || 'CLP', valorDolarUsado: null,
                    valorPotencialOriginal_DB: 0
                },
                datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 }
            };
       }
         throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }
// ... (código de snapshots de grupo, cliente, notas y transacciones sin cambios) ...
    const grupoSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', idReservaOriginal)
        .get();
    
    const reservasDelGrupo = grupoSnapshot.docs.map(d => d.data());

    let clientePromise;
    if (reservaData.clienteId) {
        clientePromise = db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();
    } else {
        clientePromise = Promise.resolve({ exists: false });
    }
    const [clienteDoc, notasSnapshot, transaccionesSnapshot] = await Promise.all([
        clientePromise,
        db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', '==', idReservaOriginal).orderBy('fecha', 'desc').get()
    ]);
    const cliente = clienteDoc.exists ? clienteDoc.data() : {};
    const notas = notasSnapshot.docs.map(d => ({...d.data(), fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const transacciones = transaccionesSnapshot.docs.map(d => ({...d.data(), id: d.id, fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));

    // --- INICIO DE LA MODIFICACIÓN: Lógica de Valor Fijo/Flotante ---
    let valorHuespedCLP, costoCanalCLP, payoutCLP, ivaCLP;
    let valorDolarUsado = null;
    const moneda = reservaData.moneda || 'CLP';

    const valorHuespedOriginal = reservaData.valores?.valorHuespedOriginal || 0;
    const costoCanalOriginal = reservaData.valores?.costoCanalOriginal || 0;
    const payoutOriginal = reservaData.valores?.valorTotalOriginal || 0;
    const ivaOriginal = reservaData.valores?.ivaOriginal || 0;

    // 1. Definir las condiciones para "congelar" el valor
    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = reservaData.fechaLlegada?.toDate ? reservaData.fechaLlegada.toDate() : null;

    const esFacturado = reservaData.estadoGestion === 'Facturado';
    const esPasado = fechaLlegada && fechaLlegada < fechaActual;
    const esFijo = esFacturado || esPasado; // Esta es TU nueva regla

    if (moneda !== 'CLP' && valorHuespedOriginal > 0) {
        if (esFijo) {
            // 2. Caso Estático (Facturado o Pasado)
            valorHuespedCLP = reservaData.valores?.valorHuesped || 0;
            costoCanalCLP = reservaData.valores?.costoCanal || 0;
            payoutCLP = reservaData.valores?.valorTotal || 0;
            ivaCLP = reservaData.valores?.iva || 0;
            
            // Determinar el dólar que se usó
            if (esFacturado) {
                valorDolarUsado = reservaData.valores?.valorDolarFacturacion || null;
            }
            if (!valorDolarUsado && fechaLlegada) {
                // Si no está facturado pero es pasado, usa el dólar de la fecha de llegada
                valorDolarUsado = await obtenerValorDolar(db, empresaId, fechaLlegada);
            }

        } else {
            // 3. Caso Flotante: Recalcular desde USD con dólar de HOY
            const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
            const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950;
            
            valorHuespedCLP = valorHuespedOriginal * valorDolarHoy;
            costoCanalCLP = costoCanalOriginal * valorDolarHoy;
            payoutCLP = payoutOriginal * valorDolarHoy;
            ivaCLP = ivaOriginal * valorDolarHoy;
            valorDolarUsado = valorDolarHoy;
        }
    } else {
        // 4. Caso Estático (CLP)
        valorHuespedCLP = reservaData.valores?.valorHuesped || 0;
        costoCanalCLP = reservaData.valores?.costoCanal || 0;
        payoutCLP = reservaData.valores?.valorTotal || 0;
        ivaCLP = reservaData.valores?.iva || 0;
    }
    // --- FIN LÓGICA DE VALORIZACIÓN ---

// ... (resto de la función: datosGrupo, abonoProporcional, valorPotencial, etc., sin cambios) ...
    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0),
        payoutTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorTotal || 0), 0),
        abonoTotal: transacciones.reduce((sum, t) => sum + (t.monto || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const abonoProporcional = (datosGrupo.valorTotal > 0)
        ? (valorHuespedCLP / datosGrupo.valorTotal) * datosGrupo.abonoTotal
        : 0;
    
    const valorCanalBase_Original = reservaData.valores?.valorOriginal || 0; // KPI (en USD)
    const valorCanalExterno_CLP = valorHuespedCLP;

    let valorCanalBase_CLP = 0;
    if (moneda === 'CLP') {
        valorCanalBase_CLP = valorCanalBase_Original;
    } else if (moneda !== 'CLP' && valorDolarUsado > 0) { // Usar el dólar (fijo o flotante) que determinamos
        valorCanalBase_CLP = valorCanalBase_Original * valorDolarUsado;
    }

    let valorPotencial_Monto = 0;
    let valorPotencial_Pct = 0;   

    if (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorCanalExterno_CLP) {
        valorPotencial_Monto = valorCanalBase_CLP - valorCanalExterno_CLP;
        valorPotencial_Pct = (valorPotencial_Monto / valorCanalBase_CLP) * 100;
    }

    const ajusteCobro = 0; 

    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente,
        notas,
        transacciones,
        
        // --- INICIO DE LA MODIFICACIÓN: Objeto de retorno final ALINEADO ---
        datosIndividuales: {
            // Valores CLP (flotantes o fijos)
            valorTotalHuesped: Math.round(valorHuespedCLP),
            costoCanal: Math.round(costoCanalCLP),
            payoutFinalReal: Math.round(payoutCLP),
            iva: Math.round(ivaCLP),
            saldo: Math.round(valorHuespedCLP - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),

            // Valores Originales (Moneda Extranjera)
            valorHuespedOriginal: valorHuespedOriginal, 
            costoCanalOriginal: costoCanalOriginal,
            valorTotalOriginal: payoutOriginal, // Payout
            ivaOriginal: ivaOriginal,

            // Metadatos de la valorización
            moneda: moneda,
            valorDolarUsado: valorDolarUsado,

            // Analítica de Potencial (KPI)
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorPotencial_Pct,
            ajusteCobro: 0,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP)
        },
        // --- FIN DE LA MODIFICACIÓN ---
        datosGrupo
    };
};

const eliminarReserva = async (db, empresaId, reservaId) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    await reservaRef.delete();
};


module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    eliminarReserva,
};