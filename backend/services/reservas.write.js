// backend/services/reservas.write.js
const pool = require('../db/postgres');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');

function _toDateStr(val) {
    if (!val) return null;
    if (typeof val === 'string') return val.split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val.toDate === 'function') return val.toDate().toISOString().split('T')[0];
    return null;
}

async function _buscarReservaPG(empresaId, idReservaCanal, alojamientoId) {
    const { rows } = await pool.query(
        `SELECT * FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2 AND propiedad_id = $3 LIMIT 1`,
        [empresaId, idReservaCanal, alojamientoId]
    );
    return rows[0] || null;
}

async function _buscarReservaIcalPG(empresaId, alojamientoId, fechaLlegada) {
    const { rows } = await pool.query(
        `SELECT * FROM reservas WHERE empresa_id = $1 AND propiedad_id = $2
         AND (metadata->>'origen') = 'ical' AND estado = 'Propuesta'
         AND fecha_llegada <= $3 AND fecha_salida >= $3 LIMIT 1`,
        [empresaId, alojamientoId, _toDateStr(fechaLlegada)]
    );
    return rows[0] || null;
}

async function _insertarReservaPG(empresaId, d) {
    const metadataExtra = {};
    if (d.alertaBloqueo !== undefined) metadataExtra.alertaBloqueo = d.alertaBloqueo;
    if (d.motivoBloqueo)               metadataExtra.motivoBloqueo = d.motivoBloqueo;
    if (d.valorDolarDia)               metadataExtra.valorDolarDia = d.valorDolarDia;
    if (d.requiereActualizacionDolar)  metadataExtra.requiereActualizacionDolar = d.requiereActualizacionDolar;

    const { rows } = await pool.query(
        `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre,
            canal_id, canal_nombre, cliente_id, nombre_cliente, total_noches,
            estado, estado_gestion, moneda, valores, documentos, id_carga,
            cantidad_huespedes, fecha_llegada, fecha_salida, fecha_reserva, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [
            empresaId, d.idReservaCanal, d.alojamientoId, d.alojamientoNombre || null,
            d.canalId || null, d.canalNombre || null, d.clienteId || null, d.nombreCliente || null,
            d.totalNoches || 0, d.estado || 'Confirmada', d.estadoGestion || null,
            d.moneda || 'CLP', JSON.stringify(d.valores || {}), JSON.stringify(d.documentos || {}),
            d.idCarga || null, d.cantidadHuespedes || 0,
            _toDateStr(d.fechaLlegada), _toDateStr(d.fechaSalida),
            d.fechaReserva ? _toDateStr(d.fechaReserva) : null,
            JSON.stringify({ origen: d.origen || 'reporte', edicionesManuales: {}, ...metadataExtra }),
        ]
    );
    return rows[0];
}

async function _crearOActualizarReservaPG(empresaId, datosReserva) {
    let existente = null;
    if (datosReserva.idReservaCanal) {
        existente = await _buscarReservaPG(empresaId, datosReserva.idReservaCanal, datosReserva.alojamientoId);
    }
    if (!existente) {
        existente = await _buscarReservaIcalPG(empresaId, datosReserva.alojamientoId, datosReserva.fechaLlegada);
    }
    if (!existente) {
        const row = await _insertarReservaPG(empresaId, datosReserva);
        return { reserva: row, status: 'creada' };
    }

    const metadata  = existente.metadata || {};
    const ediciones = metadata.edicionesManuales || {};
    const nuevosValores = { ...existente.valores, ...datosReserva.valores };
    const sets = [];
    const params = [];
    let idx = 1;

    if (metadata.origen === 'ical') {
        sets.push(`metadata = metadata || $${idx}::jsonb`);
        params.push(JSON.stringify({ origen: 'reporte', edicionesManuales: ediciones })); idx++;
    }
    sets.push(`valores = $${idx}::jsonb`);
    params.push(JSON.stringify(nuevosValores)); idx++;

    const colMap = { moneda: 'moneda', estado: 'estado', alojamientoId: 'propiedad_id', fechaLlegada: 'fecha_llegada', fechaSalida: 'fecha_salida', clienteId: 'cliente_id' };
    const isDateField = f => f === 'fechaLlegada' || f === 'fechaSalida';
    for (const [campo, col] of Object.entries(colMap)) {
        if (ediciones[campo] || datosReserva[campo] === undefined) continue;
        const valExistente = existente[col] ?? existente[campo];
        const valNuevo = datosReserva[campo];
        if (JSON.stringify(valExistente) !== JSON.stringify(valNuevo)) {
            sets.push(`${col} = $${idx}`);
            params.push(isDateField(campo) ? _toDateStr(valNuevo) : valNuevo); idx++;
        }
    }
    if (datosReserva.idCarga && existente.id_carga !== datosReserva.idCarga) {
        sets.push(`id_carga = $${idx}`); params.push(datosReserva.idCarga); idx++;
    }

    if (sets.length) {
        params.push(existente.id);
        await pool.query(`UPDATE reservas SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    }
    return { reserva: { ...existente, valores: nuevosValores }, status: sets.length ? 'actualizada' : 'sin_cambios' };
}

const crearOActualizarReserva = async (_db, empresaId, datosReserva) => {
    return _crearOActualizarReservaPG(empresaId, datosReserva);
};

async function _determinarValorDolar(db, empresaId, reserva, datosNuevos) {
    const moneda = reserva.moneda || 'CLP';
    if (moneda === 'CLP') return 1;
    const fechaLlegada = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : null;
    const fechaActual  = new Date(); fechaActual.setUTCHours(0, 0, 0, 0);
    const esFacturado  = datosNuevos.estadoGestion === 'Facturado' || reserva.estadoGestion === 'Facturado';
    const esFijo       = esFacturado || (fechaLlegada && fechaLlegada < fechaActual);
    if (esFijo) {
        const fijo = reserva.valores?.valorDolarFacturacion;
        if (fijo) return fijo;
        return fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor;
    }
    return (await obtenerValorDolarHoy(db, empresaId)).valor;
}

function _recalcularValoresSiCambia(datosNuevos, valoresExistentes, moneda, valorDolarUsado, configuracionIva, comisionOrig) {
    const nuevosValores = { ...(datosNuevos.valores || {}) };
    let valorNuevoUSD   = valoresExistentes.valorHuespedOriginal || 0;
    if (nuevosValores.valorHuesped === undefined || nuevosValores.valorHuesped === valoresExistentes.valorHuesped) {
        return { nuevosValores, valorNuevoUSD };
    }
    const nuevoHuespedCLP = nuevosValores.valorHuesped;
    const nuevoHuespedUSD = (moneda !== 'CLP' && valorDolarUsado > 0) ? nuevoHuespedCLP / valorDolarUsado : nuevoHuespedCLP;
    valorNuevoUSD = nuevoHuespedUSD;
    const recalc = recalcularValoresDesdeTotal(nuevoHuespedUSD, configuracionIva, comisionOrig);
    Object.assign(nuevosValores, {
        valorHuespedOriginal: recalc.valorHuespedOriginal,
        valorTotalOriginal:   recalc.valorTotalOriginal,
        ivaOriginal:          recalc.ivaOriginal,
        valorHuesped:         nuevoHuespedCLP,
        valorTotal:           Math.round(recalc.valorTotalOriginal * valorDolarUsado),
        iva:                  Math.round(recalc.ivaOriginal * valorDolarUsado),
    });
    return { nuevosValores, valorNuevoUSD };
}

function _construirEdicionesManualesPG(datosNuevos, valoresExistentes, nuevosValores, edicionesActuales) {
    const ediciones = { ...edicionesActuales };
    for (const key of ['estado', 'estadoGestion', 'moneda', 'fechaLlegada', 'fechaSalida']) {
        if (datosNuevos[key] !== undefined) ediciones[key] = true;
    }
    for (const key of Object.keys(nuevosValores)) {
        if (JSON.stringify(valoresExistentes[key]) !== JSON.stringify(nuevosValores[key])) {
            ediciones[`valores.${key}`] = true;
        }
    }
    return ediciones;
}

async function _actualizarReservaManualmentePG(db, empresaId, usuarioEmail, reservaId, datosNuevos) {
    const { rows } = await pool.query('SELECT * FROM reservas WHERE id = $1 AND empresa_id = $2', [reservaId, empresaId]);
    if (!rows[0]) throw new Error('La reserva no existe.');
    const row = rows[0];
    const valoresExistentes = row.valores || {};
    const metadata = row.metadata || {};
    const moneda = row.moneda || 'CLP';

    const reservaParaDolar = { moneda, valores: valoresExistentes, estadoGestion: row.estado_gestion, fechaLlegada: { toDate: () => new Date(row.fecha_llegada) } };
    const valorDolarUsado  = await _determinarValorDolar(db, empresaId, reservaParaDolar, datosNuevos);

    const { rows: canalRows } = await pool.query('SELECT metadata FROM canales WHERE id = $1 AND empresa_id = $2', [row.canal_id, empresaId]);
    const configuracionIva = canalRows[0]?.metadata?.configuracionIva || 'incluido';

    const { nuevosValores, valorNuevoUSD } = _recalcularValoresSiCambia(datosNuevos, valoresExistentes, moneda, valorDolarUsado, configuracionIva, valoresExistentes.comisionOriginal || 0);

    if (datosNuevos.estadoGestion === 'Facturado' && row.estado_gestion !== 'Facturado' && moneda !== 'CLP' && valorDolarUsado > 0) {
        nuevosValores.valorDolarFacturacion = valorDolarUsado;
    }

    const valoresFinal  = { ...valoresExistentes, ...nuevosValores };
    const edicionesManuales = _construirEdicionesManualesPG(datosNuevos, valoresExistentes, nuevosValores, metadata.edicionesManuales || {});

    const sets = [`valores = $1::jsonb`, `metadata = metadata || $2::jsonb`];
    const params = [JSON.stringify(valoresFinal), JSON.stringify({ edicionesManuales })];
    let idx = 3;

    if (datosNuevos.estadoGestion !== undefined) { sets.push(`estado_gestion = $${idx}`); params.push(datosNuevos.estadoGestion); idx++; }
    if (datosNuevos.estado !== undefined)         { sets.push(`estado = $${idx}`);         params.push(datosNuevos.estado);         idx++; }
    if (datosNuevos.fechaLlegada)                 { sets.push(`fecha_llegada = $${idx}`);  params.push(datosNuevos.fechaLlegada);   idx++; }
    if (datosNuevos.fechaSalida)                  { sets.push(`fecha_salida = $${idx}`);   params.push(datosNuevos.fechaSalida);    idx++; }

    params.push(reservaId);
    await pool.query(`UPDATE reservas SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);

    return { id: reservaId, valores: valoresFinal, estadoGestion: datosNuevos.estadoGestion ?? row.estado_gestion };
}

const actualizarReservaManualmente = async (db, empresaId, usuarioEmail, reservaId, datosNuevos) => {
    return _actualizarReservaManualmentePG(db, empresaId, usuarioEmail, reservaId, datosNuevos);
};

module.exports = { crearOActualizarReserva, actualizarReservaManualmente };
