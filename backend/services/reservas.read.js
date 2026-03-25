// backend/services/reservas.read.js
const pool = require('../db/postgres');
const { getValoresCLP } = require('./utils/calculoValoresService');

function mapearReservaPG(row) {
    return {
        id: row.id,
        idReservaCanal: row.id_reserva_canal,
        alojamientoId:  row.propiedad_id,
        alojamientoNombre: row.alojamiento_nombre,
        canalId:        row.canal_id,
        canalNombre:    row.canal_nombre,
        clienteId:      row.cliente_id,
        nombreCliente:  row.nombre_cliente,
        totalNoches:    row.total_noches,
        estado:         row.estado,
        estadoGestion:  row.estado_gestion,
        moneda:         row.moneda || 'CLP',
        valores:        row.valores || {},
        documentos:     row.documentos || {},
        idCarga:        row.id_carga,
        cantidadHuespedes: row.cantidad_huespedes || 0,
        ajusteManualRealizado: row.ajuste_manual_realizado || false,
        potencialCalculado:    row.potencial_calculado    || false,
        clienteGestionado:     row.cliente_gestionado     || false,
        origen:         row.metadata?.origen || 'reporte',
        fechaLlegada:   { toDate: () => new Date(row.fecha_llegada) },
        fechaSalida:    { toDate: () => new Date(row.fecha_salida)  },
        fechaReserva:   row.fecha_reserva || null,
        fechaCreacion:  row.created_at    || null,
        fechaActualizacion: row.updated_at || null,
        ...(row.metadata || {}),
    };
}

const obtenerReservasPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows: reservaRows } = await pool.query(
            `SELECT r.*, c.nombre AS cli_nombre, c.telefono AS cli_tel
             FROM reservas r
             LEFT JOIN clientes c ON c.id = r.cliente_id
             WHERE r.empresa_id = $1
             ORDER BY r.fecha_llegada DESC`,
            [empresaId]
        );
        if (!reservaRows.length) return [];

        return Promise.all(reservaRows.map(async row => {
            const reserva    = mapearReservaPG(row);
            const valoresCLP = await getValoresCLP(db, empresaId, reserva);
            reserva.valores.valorHuesped = valoresCLP.valorHuesped;
            reserva.valores.valorTotal   = valoresCLP.payout;
            reserva.valores.comision     = valoresCLP.comision;
            reserva.valores.costoCanal   = valoresCLP.costoCanal;
            return {
                ...reserva,
                telefono:      row.cli_tel  || 'N/A',
                nombreCliente: row.cli_nombre || reserva.nombreCliente || 'Cliente no encontrado',
                fechaLlegada:  row.fecha_llegada?.toISOString() || null,
                fechaSalida:   row.fecha_salida?.toISOString()  || null,
                fechaCreacion: row.created_at?.toISOString()    || null,
                fechaActualizacion: row.updated_at?.toISOString() || null,
                fechaReserva:  row.fecha_reserva?.toISOString() || null,
            };
        }));
    }

    const [reservasSnapshot, clientesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').orderBy('fechaLlegada', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get(),
    ]);
    if (reservasSnapshot.empty) return [];

    const clientesMap = new Map();
    clientesSnapshot.forEach(doc => clientesMap.set(doc.id, doc.data()));

    return Promise.all(reservasSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const valoresCLP = await getValoresCLP(db, empresaId, data);
        if (!data.valores) data.valores = {};
        data.valores.valorHuesped = valoresCLP.valorHuesped;
        data.valores.valorTotal   = valoresCLP.payout;
        data.valores.comision     = valoresCLP.comision;
        data.valores.costoCanal   = valoresCLP.costoCanal;
        const cliente = clientesMap.get(data.clienteId);
        return {
            ...data, id: doc.id,
            telefono:      cliente ? cliente.telefono : 'N/A',
            nombreCliente: cliente ? cliente.nombre   : 'Cliente no encontrado',
            fechaLlegada:  data.fechaLlegada?.toDate().toISOString()       || null,
            fechaSalida:   data.fechaSalida?.toDate().toISOString()         || null,
            fechaCreacion: data.fechaCreacion?.toDate().toISOString()       || null,
            fechaActualizacion: data.fechaActualizacion?.toDate().toISOString() || null,
            fechaReserva:  data.fechaReserva?.toDate().toISOString()        || null,
        };
    }));
};

const obtenerReservaPorId = async (db, empresaId, reservaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM reservas WHERE id = $1 AND empresa_id = $2', [reservaId, empresaId]
        );
        if (!rows[0]) throw new Error('Reserva no encontrada');
        return _obtenerReservaPorIdPG(db, empresaId, rows[0]);
    }
    return _obtenerReservaPorIdFirestore(db, empresaId, reservaId);
};

async function _obtenerReservaPorIdPG(db, empresaId, row) {
    const reservaData   = mapearReservaPG(row);
    const idReservaCanal = row.id_reserva_canal;

    if (!idReservaCanal) {
        return _buildPartialReserva(reservaData, row);
    }

    const [grupoRes, clienteRes, notasRes, transRes] = await Promise.all([
        pool.query('SELECT * FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]),
        row.cliente_id
            ? pool.query('SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2', [row.cliente_id, empresaId])
            : Promise.resolve({ rows: [] }),
        pool.query('SELECT * FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY created_at DESC', [empresaId, idReservaCanal]),
        pool.query('SELECT * FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY created_at DESC', [empresaId, idReservaCanal]),
    ]);

    const cliente      = clienteRes.rows[0] ? _mapearClienteSimple(clienteRes.rows[0]) : {};
    const notas        = notasRes.rows.map(r => ({ id: r.id, reservaIdOriginal: r.id_reserva_canal, texto: r.texto, autor: r.autor || '', fecha: r.created_at?.toLocaleString('es-CL') || '' }));
    const transacciones = transRes.rows.map(r => ({ id: r.id, reservaIdOriginal: r.id_reserva_canal, tipo: r.tipo, monto: r.monto, medioDePago: r.metadata?.medioDePago || '', enlaceComprobante: r.metadata?.enlaceComprobante || null, fecha: r.created_at?.toLocaleString('es-CL') || '' }));
    const reservasDelGrupo = grupoRes.rows.map(mapearReservaPG);

    return _construirDetalleReserva(db, empresaId, reservaData, row, cliente, notas, transacciones, reservasDelGrupo);
}

function _mapearClienteSimple(row) {
    const m = row.metadata || {};
    return { id: row.id, nombre: row.nombre, email: row.email, telefono: row.telefono, pais: row.pais, calificacion: row.calificacion, bloqueado: row.bloqueado, motivoBloqueo: row.motivo_bloqueo, notas: row.notas, ...m };
}

function _buildPartialReserva(reservaData, row) {
    const origen = reservaData.origen || row.metadata?.origen;
    if (origen === 'ical' && !reservaData.clienteId) {
        return {
            ...reservaData,
            fechaLlegada: row.fecha_llegada?.toISOString().split('T')[0] || null,
            fechaSalida:  row.fecha_salida?.toISOString().split('T')[0]  || null,
            fechaReserva: row.fecha_reserva?.toISOString().split('T')[0] || null,
            cliente: {}, notas: [], transacciones: [],
            datosIndividuales: { valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, valorPotencial: 0, descuentoPotencialPct: 0, abonoProporcional: 0, saldo: 0, valorHuespedOriginal: 0, valorHuespedCalculado: 0, costoCanalOriginal: 0, valorTotalOriginal: 0, ivaOriginal: 0, moneda: reservaData.moneda || 'CLP', valorDolarUsado: null, valorPotencialOriginal_DB: 0, esValorFijo: false, historialAjustes: [] },
            datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 },
        };
    }
    throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
}

async function _construirDetalleReserva(db, empresaId, reservaData, row, cliente, notas, transacciones, reservasDelGrupo) {
    const { getValoresCLP } = require('./utils/calculoValoresService');
    const valoresEnCLP = await getValoresCLP(db, empresaId, reservaData);
    const valorHuespedCLP    = valoresEnCLP.valorHuesped;
    const valoresOriginales  = reservaData.valores || {};

    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal:  reservasDelGrupo.reduce((s, r) => s + (r.valores?.valorHuesped || 0), 0),
        payoutTotal: reservasDelGrupo.reduce((s, r) => s + (r.valores?.valorTotal    || 0), 0),
        abonoTotal:  transacciones.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const abonoProporcional  = datosGrupo.valorTotal > 0 ? (valorHuespedCLP / datosGrupo.valorTotal) * datosGrupo.abonoTotal : 0;
    const valorDolarUsado    = valoresEnCLP.valorDolarUsado;
    const valorCanalBaseOrig = valoresOriginales.valorOriginal || 0;
    let valorCanalBase_CLP   = 0;
    if (reservaData.moneda === 'CLP') valorCanalBase_CLP = valorCanalBaseOrig;
    else if (valorDolarUsado > 0)     valorCanalBase_CLP = valorCanalBaseOrig * valorDolarUsado;

    const valorPotencial_Monto = (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorHuespedCLP) ? valorCanalBase_CLP - valorHuespedCLP : 0;

    return {
        ...reservaData,
        fechaLlegada: row.fecha_llegada?.toISOString().split('T')[0] || null,
        fechaSalida:  row.fecha_salida?.toISOString().split('T')[0]  || null,
        fechaReserva: row.fecha_reserva?.toISOString().split('T')[0] || null,
        cliente, notas, transacciones, datosGrupo,
        datosIndividuales: {
            valorTotalHuesped: valoresEnCLP.valorHuesped, costoCanal: valoresEnCLP.costoCanal,
            payoutFinalReal: valoresEnCLP.payout, iva: valoresEnCLP.iva,
            saldo: Math.round(valoresEnCLP.valorHuesped - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),
            valorHuespedOriginal: valoresOriginales.valorHuespedOriginal || 0,
            costoCanalOriginal:   valoresOriginales.costoCanalOriginal   || 0,
            valorTotalOriginal:   valoresOriginales.valorTotalOriginal   || 0,
            ivaOriginal:          valoresOriginales.ivaOriginal          || 0,
            moneda: reservaData.moneda || 'CLP', valorDolarUsado, esValorFijo: valoresEnCLP.esValorFijo,
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorCanalBase_CLP > 0 ? (valorPotencial_Monto / valorCanalBase_CLP) * 100 : 0,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP),
            valorOriginalCalculado: valoresOriginales.valorHuespedCalculado || 0,
            historialAjustes: [],
        },
    };
}

async function _obtenerReservaPorIdFirestore(db, empresaId, reservaId) {
    const admin = require('firebase-admin');
    const { getValoresCLP } = require('./utils/calculoValoresService');

    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const doc        = await reservaRef.get();
    if (!doc.exists) throw new Error('Reserva no encontrada');
    const reservaData    = doc.data();
    const idReservaCanal = reservaData.idReservaCanal;

    if (!idReservaCanal) {
        if (reservaData.origen === 'ical' && !reservaData.clienteId) {
            return { ...reservaData, fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null, fechaSalida: reservaData.fechaSalida?.toDate().toISOString().split('T')[0] || null, fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null, cliente: {}, notas: [], transacciones: [], datosIndividuales: { valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, valorPotencial: 0, descuentoPotencialPct: 0, abonoProporcional: 0, saldo: 0, valorHuespedOriginal: 0, valorHuespedCalculado: 0, costoCanalOriginal: 0, valorTotalOriginal: 0, ivaOriginal: 0, moneda: reservaData.moneda || 'CLP', valorDolarUsado: null, valorPotencialOriginal_DB: 0, esValorFijo: false, historialAjustes: [] }, datosGrupo: { propiedades: [reservaData.alojamientoNombre], valorTotal: 0, payoutTotal: 0, abonoTotal: 0, saldo: 0 } };
        }
        throw new Error('La reserva no tiene un identificador de grupo (idReservaCanal).');
    }

    const [grupoSnapshot, clienteDoc, notasSnapshot, transSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas').where('idReservaCanal', '==', idReservaCanal).get(),
        reservaData.clienteId ? db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get() : Promise.resolve({ exists: false }),
        db.collection('empresas').doc(empresaId).collection('gestionNotas').where('reservaIdOriginal', '==', idReservaCanal).orderBy('fecha', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('transacciones').where('reservaIdOriginal', '==', idReservaCanal).orderBy('fecha', 'desc').get(),
    ]);

    const cliente      = clienteDoc.exists ? clienteDoc.data() : {};
    const notas        = notasSnapshot.docs.map(d => ({ ...d.data(), fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const transacciones = transSnapshot.docs.map(d => ({ ...d.data(), id: d.id, fecha: d.data().fecha.toDate().toLocaleString('es-CL') }));
    const reservasDelGrupo = grupoSnapshot.docs.map(d => d.data());

    const valoresEnCLP   = await getValoresCLP(db, empresaId, reservaData);
    const valorHuespedCLP = valoresEnCLP.valorHuesped;
    const valorDolarUsado = valoresEnCLP.valorDolarUsado;
    const valoresOriginales = reservaData.valores || {};

    const datosGrupo = {
        propiedades: reservasDelGrupo.map(r => r.alojamientoNombre),
        valorTotal:  reservasDelGrupo.reduce((s, r) => s + (r.valores?.valorHuesped || 0), 0),
        payoutTotal: reservasDelGrupo.reduce((s, r) => s + (r.valores?.valorTotal    || 0), 0),
        abonoTotal:  transacciones.reduce((s, t) => s + (t.monto || 0), 0),
    };
    datosGrupo.saldo = datosGrupo.valorTotal - datosGrupo.abonoTotal;

    const abonoProporcional  = datosGrupo.valorTotal > 0 ? (valorHuespedCLP / datosGrupo.valorTotal) * datosGrupo.abonoTotal : 0;
    const valorCanalBaseOrig = valoresOriginales.valorOriginal || 0;
    let valorCanalBase_CLP   = 0;
    if (reservaData.moneda === 'CLP') valorCanalBase_CLP = valorCanalBaseOrig;
    else if (valorDolarUsado > 0)     valorCanalBase_CLP = valorCanalBaseOrig * valorDolarUsado;
    const valorPotencial_Monto = (valorCanalBase_CLP > 0 && valorCanalBase_CLP > valorHuespedCLP) ? valorCanalBase_CLP - valorHuespedCLP : 0;

    const historialAjustes = (reservaData.historialAjustes || []).map(log => ({
        ...log,
        fecha: log.fecha.toDate().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    })).sort((a, b) => {
        const toISO = s => { const p = s.split(', '); return `${p[0].split('-').reverse().join('-')}T${p[1]}`; };
        return new Date(toISO(a.fecha)) - new Date(toISO(b.fecha));
    });

    return {
        ...reservaData,
        fechaLlegada: reservaData.fechaLlegada?.toDate().toISOString().split('T')[0] || null,
        fechaSalida:  reservaData.fechaSalida?.toDate().toISOString().split('T')[0]  || null,
        fechaReserva: reservaData.fechaReserva?.toDate().toISOString().split('T')[0] || null,
        cliente, notas, transacciones, datosGrupo,
        datosIndividuales: {
            valorTotalHuesped: valoresEnCLP.valorHuesped, costoCanal: valoresEnCLP.costoCanal,
            payoutFinalReal: valoresEnCLP.payout, iva: valoresEnCLP.iva,
            saldo: Math.round(valoresEnCLP.valorHuesped - abonoProporcional),
            abonoProporcional: Math.round(abonoProporcional),
            valorHuespedOriginal: valoresOriginales.valorHuespedOriginal || 0,
            costoCanalOriginal:   valoresOriginales.costoCanalOriginal   || 0,
            valorTotalOriginal:   valoresOriginales.valorTotalOriginal   || 0,
            ivaOriginal:          valoresOriginales.ivaOriginal          || 0,
            moneda: reservaData.moneda || 'CLP', valorDolarUsado, esValorFijo: valoresEnCLP.esValorFijo,
            valorPotencial: Math.round(valorPotencial_Monto),
            descuentoPotencialPct: valorCanalBase_CLP > 0 ? (valorPotencial_Monto / valorCanalBase_CLP) * 100 : 0,
            valorPotencialOriginal_DB: Math.round(valorCanalBase_CLP),
            valorOriginalCalculado: valoresOriginales.valorHuespedCalculado || 0,
            historialAjustes,
        },
    };
}

module.exports = { obtenerReservasPorEmpresa, obtenerReservaPorId, mapearReservaPG };
