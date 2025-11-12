// backend/services/reservasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal, getValoresCLP } = require('./utils/calculoValoresService');

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
    const ajustesExistentes = reservaExistente.ajustes || {};
    const valoresExistentes = reservaExistente.valores || {};

    // --- INICIO DE LA MODIFICACIÓN: Refactorización a Servicio Central ---

    let nuevosValores = { ...(datosNuevos.valores || {}) };
    let nuevosAjustes = { ...(datosNuevos.ajustes || {}) };

    if (datosNuevos.fechaLlegada) datosNuevos.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada + 'T00:00:00Z'));
    if (datosNuevos.fechaSalida) datosNuevos.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida + 'T00:00:00Z'));

    // 1. Determinar el valor del dólar a usar (Lógica Fijo/Flotante)
    let valorDolarUsado = null;
    const moneda = reservaExistente.moneda || 'CLP';
    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = reservaExistente.fechaLlegada?.toDate ? reservaExistente.fechaLlegada.toDate() : null;
    const esFacturado = datosNuevos.estadoGestion === 'Facturado' || reservaExistente.estadoGestion === 'Facturado';
    const esPasado = fechaLlegada && fechaLlegada < fechaActual;
    const esFijo = esFacturado || esPasado;

    if (moneda !== 'CLP') {
        if (esFijo) {
            valorDolarUsado = valoresExistentes.valorDolarFacturacion || (fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor);
        } else {
            valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
        }
    } else {
        valorDolarUsado = 1; // Usar 1 para cálculos en CLP
    }

    // 2. Lógica de "Ajustar Cobro" (si el 'valorHuesped' CLP fue modificado)
    if (nuevosValores.valorHuesped !== undefined && nuevosValores.valorHuesped !== valoresExistentes.valorHuesped) {
        
        const nuevoValorHuespedCLP = nuevosValores.valorHuesped; // ej. $300,000
        let nuevoValorHuespedUSD = 0;

        if (moneda !== 'CLP' && valorDolarUsado > 0) {
            nuevoValorHuespedUSD = nuevoValorHuespedCLP / valorDolarUsado; // ej. 314.79 USD
        } else {
            nuevoValorHuespedUSD = nuevoValorHuespedCLP; // Es CLP
        }
        
        // --- LLAMADA AL SERVICIO CENTRAL DE RECÁLCULO ---
        const canal = await db.collection('empresas').doc(empresaId).collection('canales').doc(reservaExistente.canalId).get();
        const configuracionIva = canal.exists ? (canal.data().configuracionIva || 'incluido') : 'incluido';
        const comisionSumable_Orig = valoresExistentes.comisionOriginal || 0; // Se mantiene la comisión original

        // El servicio central recalcula Payout, IVA, etc., a partir del nuevo Total Cliente
        const valoresRecalculadosUSD = recalcularValoresDesdeTotal(
            nuevoValorHuespedUSD, 
            configuracionIva, 
            comisionSumable_Orig
        );

        // Calcular el ajuste contra el ancla (informativo)
        const valorAnclaUSD = valoresExistentes.valorHuespedCalculado || 0;
        const ajusteManualUSD = nuevoValorHuespedUSD - valorAnclaUSD;

        // Actualizar el objeto "nuevosValores" que se fusionará
        // Set "Actual" (USD)
        nuevosValores.valorHuespedOriginal = valoresRecalculadosUSD.valorHuespedOriginal;
        nuevosValores.valorTotalOriginal = valoresRecalculadosUSD.valorTotalOriginal; // Payout
        nuevosValores.ivaOriginal = valoresRecalculadosUSD.ivaOriginal;
        
        // Set "Actual" (CLP)
        nuevosValores.valorHuesped = nuevoValorHuespedCLP; // Usar el valor CLP exacto que ingresó el usuario
        nuevosValores.valorTotal = Math.round(valoresRecalculadosUSD.valorTotalOriginal * valorDolarUsado); // Payout CLP
        nuevosValores.iva = Math.round(valoresRecalculadosUSD.ivaOriginal * valorDolarUsado); // IVA CLP
        
        nuevosAjustes = { ...nuevosAjustes, ajusteManualUSD: ajusteManualUSD };
    }

    // 3. Lógica de "Facturación" (Congelación)
    if (datosNuevos.estadoGestion === 'Facturado' && reservaExistente.estadoGestion !== 'Facturado') {
        if (moneda !== 'CLP' && valorDolarUsado > 0) {
            nuevosValores.valorDolarFacturacion = valorDolarUsado;
        }
    }
    
    // 4. Crear el objeto final de datos a actualizar
    const datosAActualizar = {
        ...datosNuevos,
        valores: {
            ...valoresExistentes,
            ...nuevosValores
        },
        ajustes: {
            ...ajustesExistentes,
            ...nuevosAjustes
        }
    };
    // --- FIN DE LA MODIFICACIÓN ---

    // 5. Calcular Ediciones Manuales
    Object.keys(datosAActualizar).forEach(key => {
        const valorNuevo = datosAActualizar[key];
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
    
    // 6. Fusionar todo y guardar
    const datosFinalesParaUpdate = {
        ...datosAActualizar,
        edicionesManuales,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await reservaRef.update(datosFinalesParaUpdate);
    return { id: reservaId, ...datosFinalesParaUpdate };
};

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    // --- INICIO DE LA MODIFICACIÓN: Refactorización ---
    // (Eliminada la llamada a obtenerValorDolarHoy)
    
    const [reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    if (reservasSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    // 1. Iterar y llamar al servicio central para cada reserva
    const reservasConCLP = await Promise.all(
        reservasSnapshot.docs.map(async (doc) => {
            const data = doc.data();
            // Llamamos al servicio central para obtener los CLP (flotantes o fijos)
            const valoresCLP = await getValoresCLP(db, empresaId, data);
            
            // Sobrescribimos los valores CLP estáticos con los correctos
            if (!data.valores) data.valores = {};
            data.valores.valorHuesped = valoresCLP.valorHuesped;
            data.valores.valorTotal = valoresCLP.payout; // 'valorTotal' es Payout
            data.valores.comision = valoresCLP.comision;
            data.valores.costoCanal = valoresCLP.costoCanal;
            
            return { id: doc.id, data: data };
        })
    );

    // 2. Mapear los resultados finales
    return reservasConCLP.map(item => {
        const data = item.data;
        const cliente = clientesMap.get(data.clienteId);
        return {
            ...data,
            id: item.id,
            telefono: cliente ? cliente.telefono : 'N/A',
            nombreCliente: cliente ? cliente.nombre : 'Cliente no encontrado',
            fechaLlegada: data.fechaLlegada?.toDate().toISOString() || null,
            fechaSalida: data.fechaSalida?.toDate().toISOString() || null,
            fechaCreacion: data.fechaCreacion?.toDate().toISOString() || null,
            fechaActualizacion: data.fechaActualizacion?.toDate().toISOString() || null,
            fechaReserva: data.fechaReserva?.toDate().toISOString() || null
        };
    });
    // --- FIN DE LA MODIFICACIÓN ---
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
                    saldo: 0,
                    valorHuespedOriginal: 0,
                    valorHuespedCalculado: 0, 
                    costoCanalOriginal: 0, 
                    valorTotalOriginal: 0,
                    ivaOriginal: 0,
                    moneda: reservaData.moneda || 'CLP', valorDolarUsado: null,
                    valorPotencialOriginal_DB: 0,
                    esValorFijo: false,
                    historialAjustes: {}
                },
                datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 }
            };
       }
         throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }

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

    // --- INICIO DE LA MODIFICACIÓN: Refactorización a Servicio Central ---
    
    // 1. Llamar al servicio central de valorización
    const valoresEnCLP = await getValoresCLP(db, empresaId, reservaData);
    const valorHuespedCLP = valoresEnCLP.valorHuesped;
    const valorDolarUsado = valoresEnCLP.valorDolarUsado;
    
    // 2. Leer los valores "Actuales" (USD) de la BBDD
    const valoresOriginales = reservaData.valores || {};
    const valorHuespedOriginal = valoresOriginales.valorHuespedOriginal || 0;
    const costoCanalOriginal = valoresOriginales.costoCanalOriginal || 0;
    const payoutOriginal = valoresOriginales.valorTotalOriginal || 0;
    const ivaOriginal = valoresOriginales.ivaOriginal || 0;
    
    // 3. Leer el "Ancla" (USD) y el "Historial"
    const valorAnclaUSD = valoresOriginales.valorHuespedCalculado || 0;
    const historialAjustes = reservaData.ajustes || {};

    // --- FIN DE LA MODIFICACIÓN ---


    // --- LÓGICA DE DATOS DE GRUPO (Cálculo de Abono) ---
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
    
    // --- Lógica de Valor Potencial (KPI) ---
    const valorCanalBase_Original = valoresOriginales.valorOriginal || 0; // KPI (en USD/moneda canal)
    const valorCanalExterno_CLP = valorHuespedCLP;

    let valorCanalBase_CLP = 0;
    if (reservaData.moneda === 'CLP') {
        valorCanalBase_CLP = valorCanalBase_Original;
    } else if (reservaData.moneda !== 'CLP' && valorDolarUsado > 0) {
        valorCanalBase_CLP = valorCanalBase_Original * valorDolarUsado;
    }

    let valorPotencial_Monto = 0;
    let valorPotencial_Pct = 0;   

    if (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorCanalExterno_CLP) {
        valorPotencial_Monto = valorCanalBase_CLP - valorCanalExterno_CLP;
        // Corregido el cálculo del porcentaje
        valorPotencial_Pct = (valorPotencial_Monto / valorCanalBase_CLP) * 100;
    }

    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente,
        notas,
        transacciones,
        
        // --- INICIO DE LA MODIFICACIÓN: Objeto de retorno final ---
        datosIndividuales: {
            // Valores CLP (calculados por el servicio central)
            valorTotalHuesped: valoresEnCLP.valorHuesped,
            costoCanal: valoresEnCLP.costoCanal,
            payoutFinalReal: valoresEnCLP.payout,
            iva: valoresEnCLP.iva,
            saldo: Math.round(valoresEnCLP.valorHuesped - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),

            // Valores Originales (Moneda Extranjera, leídos de la BBDD)
            valorHuespedOriginal: valorHuespedOriginal, 
            costoCanalOriginal: costoCanalOriginal,
            valorTotalOriginal: payoutOriginal, // Payout
            ivaOriginal: ivaOriginal,

            // Metadatos de la valorización (del servicio central)
            moneda: reservaData.moneda || 'CLP',
            valorDolarUsado: valoresEnCLP.valorDolarUsado,
            esValorFijo: valoresEnCLP.esValorFijo,

            // Analítica de Potencial (KPI)
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorPotencial_Pct,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP),
            
            // Trazabilidad (leído de la BBDD)
            valorOriginalCalculado: valorAnclaUSD,
            historialAjustes: historialAjustes
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