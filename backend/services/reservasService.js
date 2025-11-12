// backend/services/reservasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');

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

    // Copiamos los datos que llegan para no modificar el original
    let nuevosValores = { ...(datosNuevos.valores || {}) };
    let nuevosAjustes = { ...(datosNuevos.ajustes || {}) };

    if (datosNuevos.fechaLlegada) datosNuevos.fechaLlegada = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaLlegada + 'T00:00:00Z'));
    if (datosNuevos.fechaSalida) datosNuevos.fechaSalida = admin.firestore.Timestamp.fromDate(new Date(datosNuevos.fechaSalida + 'T00:00:00Z'));

    // --- INICIO DE LA MODIFICACIÓN: Lógica de Trazabilidad y Ajuste de Cobro ---

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
            valorDolarUsado = reservaExistente.valores?.valorDolarFacturacion || (fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor);
        } else {
            valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
        }
    }

    // 2. Lógica de "Ajustar Cobro" (si el 'valorHuesped' CLP fue modificado)
    if (nuevosValores.valorHuesped !== undefined && nuevosValores.valorHuesped !== valoresExistentes.valorHuesped) {
        
        const nuevoValorHuespedCLP = nuevosValores.valorHuesped; // El valor de $400.000
        let nuevoValorHuespedUSD = 0;
        let ajusteManualUSD = 0;

        if (moneda !== 'CLP' && valorDolarUsado > 0) {
            nuevoValorHuespedUSD = nuevoValorHuespedCLP / valorDolarUsado; // $400.000 / 953.2 = 419.64
        } else {
            nuevoValorHuespedUSD = nuevoValorHuespedCLP;
        }

        const valorAnclaUSD = valoresExistentes.valorHuespedCalculado || 0; // 424.12

        if (valorAnclaUSD > 0) {
            ajusteManualUSD = nuevoValorHuespedUSD - valorAnclaUSD; // 419.64 - 424.12 = -4.48
        }

        // Actualizar los objetos que se van a fusionar
        nuevosValores.valorHuespedOriginal = nuevoValorHuespedUSD; // Sobrescribir el valor "Actual" USD
        nuevosAjustes = { ...nuevosAjustes, ajusteManualUSD: ajusteManualUSD }; // Guardar el historial
    }

    // 3. Lógica de "Facturación" (Congelación)
    if (datosNuevos.estadoGestion === 'Facturado' && reservaExistente.estadoGestion !== 'Facturado') {
        if (moneda !== 'CLP' && valorDolarUsado > 0) {
            nuevosValores.valorDolarFacturacion = valorDolarUsado;
        }
    }
    
    // 4. Crear el objeto final de datos a actualizar
    const datosAActualizar = {
        ...datosNuevos, // Trae los campos de primer nivel (ej. estadoGestion)
        valores: {
            ...valoresExistentes,
            ...nuevosValores // Sobrescribe con los valores nuevos (ej. valorHuesped, valorHuespedOriginal)
        },
        ajustes: {
            ...ajustesExistentes,
            ...nuevosAjustes // Sobrescribe con los nuevos ajustes
        }
    };
    // --- FIN DE LA MODIFICACIÓN ---

    // 5. Calcular Ediciones Manuales (Iterar sobre el objeto final)
    Object.keys(datosAActualizar).forEach(key => {
        const valorNuevo = datosAActualizar[key];
        const valorExistente = reservaExistente[key];
        
        if (typeof valorNuevo === 'object' && valorNuevo !== null && !Array.isArray(valorNuevo)) {
            // Iterar sub-claves (para 'valores' y 'ajustes')
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
                    valorHuespedOriginal: 0, // Actual
                    valorHuespedCalculado: 0, // Ancla
                    costoCanalOriginal: 0, 
                    valorTotalOriginal: 0, // Payout
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

    // --- Lógica de Valor Fijo/Flotante (G-029) ---
    let valorHuespedCLP, costoCanalCLP, payoutCLP, ivaCLP;
    let valorDolarUsado = null;
    const moneda = reservaData.moneda || 'CLP';

    const valorHuespedOriginal = reservaData.valores?.valorHuespedOriginal || 0; // El "Actual"
    const costoCanalOriginal = reservaData.valores?.costoCanalOriginal || 0;
    const payoutOriginal = reservaData.valores?.valorTotalOriginal || 0;
    const ivaOriginal = reservaData.valores?.ivaOriginal || 0;

    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = reservaData.fechaLlegada?.toDate ? reservaData.fechaLlegada.toDate() : null;

    const esFacturado = reservaData.estadoGestion === 'Facturado';
    const esPasado = fechaLlegada && fechaLlegada < fechaActual;
    const esFijo = esFacturado || esPasado;

    if (moneda !== 'CLP' && valorHuespedOriginal > 0) {
        if (esFijo) {
            // Caso Estático (Facturado o Pasado)
            valorHuespedCLP = reservaData.valores?.valorHuesped || 0;
            costoCanalCLP = reservaData.valores?.costoCanal || 0;
            payoutCLP = reservaData.valores?.valorTotal || 0;
            ivaCLP = reservaData.valores?.iva || 0;
            
            if (esFacturado) {
                valorDolarUsado = reservaData.valores?.valorDolarFacturacion || null;
            }
            if (!valorDolarUsado && fechaLlegada) {
                valorDolarUsado = await obtenerValorDolar(db, empresaId, fechaLlegada);
            }
        } else {
            // Caso Flotante: Recalcular desde USD con dólar de HOY
            const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
            const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950;
            
            valorHuespedCLP = valorHuespedOriginal * valorDolarHoy;
            costoCanalCLP = costoCanalOriginal * valorDolarHoy;
            payoutCLP = payoutOriginal * valorDolarHoy;
            ivaCLP = ivaOriginal * valorDolarHoy;
            valorDolarUsado = valorDolarHoy;
        }
    } else {
        // Caso Estático (CLP)
        valorHuespedCLP = reservaData.valores?.valorHuesped || 0;
        costoCanalCLP = reservaData.valores?.costoCanal || 0;
        payoutCLP = reservaData.valores?.valorTotal || 0;
        ivaCLP = reservaData.valores?.iva || 0;
    }
    // --- FIN LÓGICA DE VALORIZACIÓN ---


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
    const valorCanalBase_Original = reservaData.valores?.valorOriginal || 0; // KPI (en USD/moneda canal)
    const valorCanalExterno_CLP = valorHuespedCLP;

    let valorCanalBase_CLP = 0;
    if (moneda === 'CLP') {
        valorCanalBase_CLP = valorCanalBase_Original;
    } else if (moneda !== 'CLP' && valorDolarUsado > 0) {
        valorCanalBase_CLP = valorCanalBase_Original * valorDolarUsado;
    }

    let valorPotencial_Monto = 0;
    let valorPotencial_Pct = 0;   

    if (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorCanalExterno_CLP) {
        valorPotencial_Monto = valorCanalBase_CLP - valorCanalExterno_CLP;
        valorPotencial_Pct = (valorPotencial_Monto / valorCanalBase_CLP) * 100;
    }

    // --- INICIO DE LA MODIFICACIÓN: Leer "Ancla" e "Historial" ---
    const valorAnclaUSD = reservaData.valores?.valorHuespedCalculado || 0;
    const historialAjustes = reservaData.ajustes || {};
    // --- FIN DE LA MODIFICACIÓN ---


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
            // Valores CLP (flotantes o fijos)
            valorTotalHuesped: Math.round(valorHuespedCLP), // "Actual" en CLP
            costoCanal: Math.round(costoCanalCLP),
            payoutFinalReal: Math.round(payoutCLP),
            iva: Math.round(ivaCLP),
            saldo: Math.round(valorHuespedCLP - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),

            // Valores Originales (Moneda Extranjera)
            valorHuespedOriginal: valorHuespedOriginal, // "Actual" en USD
            costoCanalOriginal: costoCanalOriginal,
            valorTotalOriginal: payoutOriginal, // Payout
            ivaOriginal: ivaOriginal,

            // Metadatos de la valorización
            moneda: moneda,
            valorDolarUsado: valorDolarUsado,
            esValorFijo: esFijo,

            // Analítica de Potencial (KPI)
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorPotencial_Pct,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP),
            
            // Trazabilidad (¡NUEVO!)
            valorOriginalCalculado: valorAnclaUSD, // El "Ancla"
            historialAjustes: historialAjustes // El Historial
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