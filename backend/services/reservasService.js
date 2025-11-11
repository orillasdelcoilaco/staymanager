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
                    saldo: 0, ajusteCobro: 0, valorHuespedOriginal: 0, 
                    costoCanalOriginal: 0, moneda: reservaData.moneda || 'CLP', valorDolarUsado: null
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

    // --- LÓGICA DE VALORIZACIÓN FLOTANTE (Paso anterior) ---
    let valorHuespedCLP, costoCanalCLP, payoutCLP;
    let valorDolarUsado = null;
    const moneda = reservaData.moneda || 'CLP';
    const valorHuespedOriginal = reservaData.valores?.valorHuespedOriginal || 0;
    const costoCanalOriginal = reservaData.valores?.comisionOriginal || reservaData.valores?.costoCanalOriginal || 0;
    const valorHuespedCongelado = reservaData.valores?.valorHuesped || 0;
    const costoCanalCongelado = reservaData.valores?.comision || reservaData.valores?.costoCanal || 0;

    if (moneda !== 'CLP' && valorHuespedOriginal > 0) {
        if (reservaData.estadoGestion === 'Facturado') {
            valorHuespedCLP = valorHuespedCongelado;
            costoCanalCLP = costoCanalCongelado;
            valorDolarUsado = reservaData.valores?.valorDolarFacturacion || null;
        } else {
            const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
            const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950;
            valorHuespedCLP = valorHuespedOriginal * valorDolarHoy;
            costoCanalCLP = costoCanalOriginal * valorDolarHoy;
            valorDolarUsado = valorDolarHoy;
        }
    } else {
        valorHuespedCLP = valorHuespedCongelado;
        costoCanalCLP = costoCanalCongelado;
    }
    payoutCLP = valorHuespedCLP - costoCanalCLP;
    // --- FIN LÓGICA DE VALORIZACIÓN ---


    // --- LÓGICA DE DATOS DE GRUPO (Cálculo de Abono) ---
    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0), // (Sigue siendo un desafío, el grupo no se recalcula flotante aquí)
        payoutTotal: reservasDelGrupo.reduce((sum, r) => sum + (r.valores?.valorTotal || 0), 0),
        abonoTotal: transacciones.reduce((sum, t) => sum + (t.monto || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const abonoProporcional = (datosGrupo.valorTotal > 0)
        ? (valorHuespedCLP / datosGrupo.valorTotal) * datosGrupo.abonoTotal
        : 0;
    
    // --- INICIO DE LA MODIFICACIÓN: Cálculo correcto de Valor Potencial ---
    
    // 1. Cargar el "Precio Base" (Valor Canal Base) desde la BBDD.
    //    Este campo DEBE ser calculado y guardado por el servicio de Carga/Consolidación.
    const valorCanalBase_CLP = reservaData.valores?.valorPotencial || 0;

    // 2. Cargar el "Precio Externo" (ya lo tenemos de la lógica flotante)
    const valorCanalExterno_CLP = valorHuespedCLP;

    // 3. Calcular los dos campos que ve el modal
    let valorPotencial_Monto = 0; // El monto de la "pérdida"
    let valorPotencial_Pct = 0;   // El porcentaje de esa "pérdida"

    // Solo calcular si el Precio Base es válido y mayor que el precio externo
    if (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorCanalExterno_CLP) {
        valorPotencial_Monto = valorCanalBase_CLP - valorCanalExterno_CLP;
        valorPotencial_Pct = (valorPotencial_Monto / valorCanalBase_CLP) * 100;
    }
    // --- FIN DE LA MODIFICACIÓN ---

    const valorHuespedOriginalBBDD = reservaData.valores?.valorHuespedOriginal || 0; // Esto es confuso, es el valorHuesped en USD
    const ajusteCobro = (valorHuespedOriginalBBDD > 0 && valorHuespedOriginalBBDD !== valorHuespedCLP)
        ? valorHuespedCLP - valorHuespedOriginalBBDD
        : 0; // (Esta lógica de 'ajusteCobro' parece incorrecta, compara USD (valorHuespedOriginalBBDD) con CLP)


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
            // Valores CLP (flotantes o congelados)
            valorTotalHuesped: Math.round(valorHuespedCLP),
            costoCanal: Math.round(costoCanalCLP),
            payoutFinalReal: Math.round(payoutCLP),
            saldo: Math.round(valorHuespedCLP - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),

            // Valores Originales (Moneda Extranjera) - El frontend NO los está usando
            valorHuespedOriginal: valorHuespedOriginal, 
            costoCanalOriginal: costoCanalOriginal,

            // Metadatos de la valorización - El frontend NO los está usando
            moneda: moneda,
            valorDolarUsado: valorDolarUsado,

            // Analítica de Potencial (Esto SÍ lo usa el frontend)
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorPotencial_Pct,
            
            // (Campos heredados, revisar lógica de 'ajusteCobro')
            ajusteCobro: Math.round(ajusteCobro),
            valorHuespedOriginal: valorHuespedOriginal, // (Confuso, frontend puede estar usando este mal)
            valorPotencialOriginal_DB: valorCanalBase_CLP // (Devuelvo el precio base por si acaso)
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