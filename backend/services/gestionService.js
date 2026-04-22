// backend/services/gestionService.js
const pool = require('../db/postgres');
const { getValoresCLP } = require('./utils/calculoValoresService');
const { obtenerEstados } = require('./estadosService');

const splitIntoChunks = (arr, size) => {
    if (!arr || arr.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

// Normalizes a PG reserva row to the shape the aggregation logic expects
function normalizarReservaPG(row) {
    const valores = row.valores || {};
    return {
        id:                    row.id,
        idReservaCanal:        row.id_reserva_canal,
        propiedadId:           row.propiedad_id,
        canalId:               row.canal_id,
        clienteId:             row.cliente_id,
        alojamientoNombre:     row.alojamiento_nombre,
        canalNombre:           row.canal_nombre,
        nombreCliente:         row.nombre_cliente,
        fechaLlegada:          { toDate: () => new Date(row.fecha_llegada) },
        fechaSalida:           { toDate: () => new Date(row.fecha_salida) },
        totalNoches:           row.total_noches,
        estado:                row.estado,
        estadoGestion:         row.estado_gestion,
        moneda:                row.moneda || 'CLP',
        valores,
        documentos:            row.documentos || {},
        alertaBloqueo:         valores.alertaBloqueo || false,
        motivoBloqueo:         valores.motivoBloqueo || '',
        ajusteManualRealizado: row.ajuste_manual_realizado || false,
        potencialCalculado:    row.potencial_calculado    || false,
        clienteGestionado:     row.cliente_gestionado     || false,
    };
}

async function _enriquecerConCLP(_db, empresaId, reservasData) {
    return Promise.all(reservasData.map(async (reserva) => {
        const valoresCLP = await getValoresCLP(null, empresaId, reserva);
        return { ...reserva, valoresCLP };
    }));
}

async function _cargarReservasPG(_db, empresaId) {
    const { rows: estadosRows } = await pool.query(
        'SELECT nombre FROM estados_reserva WHERE empresa_id = $1 AND es_gestion = true',
        [empresaId]
    );
    const estadosDeGestion = estadosRows.map(r => r.nombre);

    let reservasRows;
    if (estadosDeGestion.length > 0) {
        const { rows } = await pool.query(
            `SELECT * FROM reservas
             WHERE empresa_id = $1
               AND ((estado = 'Confirmada' AND estado_gestion = ANY($2)) OR estado = 'Desconocido')
             ORDER BY fecha_llegada ASC`,
            [empresaId, estadosDeGestion]
        );
        reservasRows = rows;
    } else {
        const { rows } = await pool.query(
            `SELECT * FROM reservas WHERE empresa_id = $1 AND estado = 'Desconocido'
             ORDER BY fecha_llegada ASC`,
            [empresaId]
        );
        reservasRows = rows;
    }
    if (!reservasRows.length) return null;
    return reservasRows.map(normalizarReservaPG);
}

async function _cargarDatosAuxiliaresPG(_db, empresaId, allReservasConCLP) {
    const clienteIds     = [...new Set(allReservasConCLP.map(r => r.clienteId).filter(Boolean))];
    const idsCanalUnicos = [...new Set(allReservasConCLP.map(r => r.idReservaCanal).filter(Boolean))];

    const [clientesRes, notasRes, transRes, historialRes] = await Promise.all([
        clienteIds.length
            ? pool.query('SELECT * FROM clientes WHERE empresa_id = $1 AND id = ANY($2)', [empresaId, clienteIds])
            : { rows: [] },
        idsCanalUnicos.length
            ? pool.query(
                `SELECT id_reserva_canal, COUNT(*)::int AS count
                 FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)
                 GROUP BY id_reserva_canal`,
                [empresaId, idsCanalUnicos]
              )
            : { rows: [] },
        idsCanalUnicos.length
            ? pool.query(
                `SELECT id_reserva_canal, SUM(monto) AS total, COUNT(*)::int AS count
                 FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)
                 GROUP BY id_reserva_canal`,
                [empresaId, idsCanalUnicos]
              )
            : { rows: [] },
        clienteIds.length
            ? pool.query(
                `SELECT * FROM reservas WHERE empresa_id = $1 AND cliente_id = ANY($2) AND estado = 'Confirmada'`,
                [empresaId, clienteIds]
              )
            : { rows: [] },
    ]);
    return { clienteIds, clientesRes, notasRes, transRes, historialRes };
}

async function _construirClientsMapPG(_db, empresaId, clientesRes, historialRes) {
    const historialConCLP = await _enriquecerConCLP(null, empresaId, historialRes.rows.map(normalizarReservaPG));
    const clientsMap = new Map();
    clientesRes.rows.forEach(row => {
        const m = row.metadata || {};
        const historialCliente = historialConCLP.filter(r => r.clienteId === row.id);
        const totalGastado     = historialCliente.reduce((s, r) => s + (r.valoresCLP.valorHuesped || 0), 0);
        const numeroDeReservas = historialCliente.length;
        let tipoCliente = 'Cliente Nuevo';
        if (totalGastado > 1000000) tipoCliente = 'Cliente Premium';
        else if (numeroDeReservas > 1) tipoCliente = 'Cliente Frecuente';
        clientsMap.set(row.id, {
            id: row.id, nombre: row.nombre, telefono: row.telefono,
            tipoCliente: m.tipoCliente || tipoCliente,
            numeroDeReservas: m.numeroDeReservas ?? numeroDeReservas,
        });
    });
    return clientsMap;
}

const getReservasPendientes = async (_db, empresaId) => {
    const allReservasData = await _cargarReservasPG(null, empresaId);
    if (!allReservasData) return { grupos: [], hasMore: false, lastVisible: null };

    const allReservasConCLP = await _enriquecerConCLP(null, empresaId, allReservasData);
    const { clientesRes, notasRes, transRes, historialRes } =
        await _cargarDatosAuxiliaresPG(null, empresaId, allReservasConCLP);

    const clientsMap    = await _construirClientsMapPG(null, empresaId, clientesRes, historialRes);
    const notesCountMap = new Map(notasRes.rows.map(r => [r.id_reserva_canal, r.count]));
    const abonosMap     = new Map(transRes.rows.map(r => [r.id_reserva_canal, parseFloat(r.total) || 0]));
    const transCountMap = new Map(transRes.rows.map(r => [r.id_reserva_canal, r.count]));

    return _agruparYProcesar(allReservasConCLP, clientsMap, notesCountMap, abonosMap, transCountMap);
};

function _agruparYProcesar(allReservasConCLP, clientsMap, notesCountMap, abonosMap, transCountMap) {
    const reservasAgrupadas = new Map();
    allReservasConCLP.forEach(data => {
        const reservaId = data.idReservaCanal;
        if (!reservasAgrupadas.has(reservaId)) {
            const clienteActual = clientsMap.get(data.clienteId);
            reservasAgrupadas.set(reservaId, {
                reservaIdOriginal: reservaId,
                clienteId:         data.clienteId,
                clienteNombre:     clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
                telefono:          clienteActual?.telefono || 'N/A',
                tipoCliente:       clienteActual?.tipoCliente || 'Nuevo',
                numeroDeReservas:  clienteActual?.numeroDeReservas || 1,
                fechaLlegada:      data.fechaLlegada?.toDate(),
                fechaSalida:       data.fechaSalida?.toDate(),
                totalNoches:       data.totalNoches,
                estado:            data.estado,
                estadoGestion:     data.estadoGestion,
                clienteBloqueado:  data.alertaBloqueo === true,
                motivoBloqueo:     data.motivoBloqueo || '',
                abonoTotal:        abonosMap.get(reservaId) || 0,
                notasCount:        notesCountMap.get(reservaId) || 0,
                transaccionesCount: transCountMap.get(reservaId) || 0,
                reservasIndividuales: [],
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values()).map(grupo => {
        const primerReserva    = grupo.reservasIndividuales[0];
        const monedaGrupo      = primerReserva.moneda || 'CLP';
        const estadoGestionGrupo = primerReserva.estadoGestion;

        const valoresAgregados = grupo.reservasIndividuales.reduce((acc, r) => {
            acc.valorTotalHuesped    += r.valoresCLP.valorHuesped;
            acc.costoCanal           += r.valoresCLP.costoCanal;
            acc.payoutFinalReal      += r.valoresCLP.payout;
            acc.valorListaBaseTotal  += r.valores?.valorOriginal || 0;
            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado)    acc.potencialCalculado    = true;
            if (r.clienteGestionado)     acc.clienteGestionado     = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };
            return acc;
        }, { valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, valorListaBaseTotal: 0, ajusteManualRealizado: false, potencialCalculado: false, clienteGestionado: false, documentos: {} });

        const resultado = { ...grupo, ...valoresAgregados, esUSD: monedaGrupo === 'USD' };

        if (resultado.esUSD) {
            const valorDolarParaCalculo = (estadoGestionGrupo === 'Facturado')
                ? (primerReserva.valores?.valorDolarFacturacion || primerReserva.valoresCLP.valorDolarUsado || 950)
                : (primerReserva.valoresCLP.valorDolarUsado || 950);
            const totalPayoutUSD = grupo.reservasIndividuales.reduce((s, r) => s + (r.valores?.valorTotalOriginal || 0), 0);
            const totalIvaUSD    = grupo.reservasIndividuales.reduce((s, r) => s + (r.valores?.ivaOriginal    || 0), 0);
            resultado.valoresUSD = { payout: totalPayoutUSD, iva: totalIvaUSD, totalCliente: totalPayoutUSD + totalIvaUSD, valorDolar: valorDolarParaCalculo };
        }
        return resultado;
    });

    return { grupos: gruposProcesados, hasMore: false, lastVisible: null };
}

const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => {
    const allEstados = await obtenerEstados(db, empresaId);
    const estadoDef  = allEstados.find(e => e.nombre === nuevoEstado);

    const updateData = {};
    if (estadoDef) {
        if (estadoDef.esEstadoPrincipal)  updateData.estado = nuevoEstado;
        if (estadoDef.esEstadoDeGestion)  updateData.estadoGestion = nuevoEstado;
        else if (estadoDef.esEstadoPrincipal) updateData.estadoGestion = null;
    } else {
        console.warn(`[actualizarEstadoGrupo] Estado "${nuevoEstado}" no encontrado. Actualizando solo estadoGestion.`);
        updateData.estadoGestion = nuevoEstado;
    }
    if (!Object.keys(updateData).length) updateData.estadoGestion = nuevoEstado;

    await pool.query(
        `UPDATE reservas SET
            estado         = COALESCE($2, estado),
            estado_gestion = $3,
            updated_at     = NOW()
         WHERE id = ANY($1) AND empresa_id = $4`,
        [idsIndividuales, updateData.estado || null, updateData.estadoGestion ?? null, empresaId]
    );
};

const getNotas = async (_db, empresaId, reservaIdOriginal) => {
    const { rows } = await pool.query(
        `SELECT * FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY created_at DESC`,
        [empresaId, reservaIdOriginal]
    );
    return rows.map(row => ({
        id:                row.id,
        reservaIdOriginal: row.id_reserva_canal,
        texto:             row.texto,
        autor:             row.autor || '',
        fecha:             row.created_at?.toLocaleString('es-CL') || '',
    }));
};

const addNota = async (_db, empresaId, notaData) => {
    const { rows } = await pool.query(
        `INSERT INTO bitacora (empresa_id, id_reserva_canal, texto, autor)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [empresaId, notaData.reservaIdOriginal, notaData.texto, notaData.autor || '']
    );
    return {
        id:                rows[0].id,
        reservaIdOriginal: rows[0].id_reserva_canal,
        texto:             rows[0].texto,
        autor:             rows[0].autor || '',
        fecha:             rows[0].created_at,
    };
};

const getTransacciones = async (_db, empresaId, idsIndividuales) => {
    const { rows: reservaRows } = await pool.query(
        'SELECT id_reserva_canal FROM reservas WHERE id = $1 AND empresa_id = $2',
        [idsIndividuales[0], empresaId]
    );
    if (!reservaRows[0]) return [];
    const idReservaCanal = reservaRows[0].id_reserva_canal;
    const { rows } = await pool.query(
        `SELECT * FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY fecha DESC NULLS LAST`,
        [empresaId, idReservaCanal]
    );
    return rows.map(row => ({
        id:                row.id,
        reservaIdOriginal: row.id_reserva_canal,
        tipo:              row.tipo,
        monto:             row.monto,
        medioDePago:       row.metadata?.medioDePago || '',
        enlaceComprobante: row.metadata?.enlaceComprobante || null,
        fecha:             row.fecha || new Date(),
    }));
};

const marcarClienteComoGestionado = async (_db, empresaId, reservaIdOriginal) => {
    const { rowCount } = await pool.query(
        `UPDATE reservas SET cliente_gestionado = true, updated_at = NOW()
         WHERE empresa_id = $1 AND id_reserva_canal = $2`,
        [empresaId, reservaIdOriginal]
    );
    if (!rowCount) throw new Error('No se encontraron reservas para marcar al cliente como gestionado.');
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado,
};
