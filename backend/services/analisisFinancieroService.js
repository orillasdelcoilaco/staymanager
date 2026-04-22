// backend/services/analisisFinancieroService.js
const pool = require('../db/postgres');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');

async function _determinarValorDolarGrupo(db, empresaId, primeraReserva) {
    const moneda = primeraReserva.moneda || 'CLP';
    if (moneda === 'CLP') return 1;
    const fechaActual = new Date(); fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = primeraReserva.fechaLlegada?.toDate ? primeraReserva.fechaLlegada.toDate() : (primeraReserva.fecha_llegada ? new Date(primeraReserva.fecha_llegada) : null);
    const esFacturado = primeraReserva.estadoGestion === 'Facturado' || primeraReserva.estado_gestion === 'Facturado';
    const esFijo = esFacturado || (fechaLlegada && fechaLlegada < fechaActual);
    if (esFijo) {
        const fijo = (primeraReserva.valores || primeraReserva.valores)?.valorDolarFacturacion;
        if (fijo) return fijo;
        return fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor;
    }
    return (await obtenerValorDolarHoy(db, empresaId)).valor;
}

function _calcularNuevosValoresReserva(reservaValores, proporcion, recalcGrupoUSD, nuevoTotalCLP, valorDolarUsado) {
    const nuevos = { ...reservaValores };
    nuevos.valorHuespedOriginal = recalcGrupoUSD.valorHuespedOriginal * proporcion;
    nuevos.valorTotalOriginal   = recalcGrupoUSD.valorTotalOriginal   * proporcion;
    nuevos.ivaOriginal          = recalcGrupoUSD.ivaOriginal          * proporcion;
    nuevos.valorHuesped = Math.round(nuevoTotalCLP * proporcion);
    nuevos.valorTotal   = Math.round(recalcGrupoUSD.valorTotalOriginal * proporcion * valorDolarUsado);
    nuevos.iva          = Math.round(recalcGrupoUSD.ivaOriginal        * proporcion * valorDolarUsado);
    return nuevos;
}

const actualizarValoresGrupo = async (db, empresaId, _usuarioEmail, valoresCabanas, nuevoTotalHuesped) => {
    const ids = valoresCabanas.map(i => i.id);

    const { rows: reservaRows } = await pool.query(
        'SELECT * FROM reservas WHERE id = ANY($1) AND empresa_id = $2', [ids, empresaId]
    );
    if (!reservaRows.length) throw new Error('No se encontraron las reservas para actualizar.');

    const primera = reservaRows[0];
    const moneda  = primera.moneda || 'CLP';
    const canalId = primera.canal_id;
    const totalHuespedActualCLP = reservaRows.reduce((s, r) => s + (r.valores?.valorHuesped || 0), 0);
    const comisionOriginalTotal = reservaRows.reduce((s, r) => s + (r.valores?.comisionOriginal || 0), 0);

    const valorDolarUsado = await _determinarValorDolarGrupo(db, empresaId, primera);
    const nuevoTotalHuespedCLP = parseFloat(nuevoTotalHuesped);
    const nuevoTotalUSD = (moneda !== 'CLP' && valorDolarUsado > 0) ? nuevoTotalHuespedCLP / valorDolarUsado : nuevoTotalHuespedCLP;

    const { rows: canalRows } = await pool.query('SELECT metadata FROM canales WHERE id = $1 AND empresa_id = $2', [canalId, empresaId]);
    const configuracionIva = canalRows[0]?.metadata?.configuracionIva || 'incluido';
    const recalcGrupoUSD   = recalcularValoresDesdeTotal(nuevoTotalUSD, configuracionIva, comisionOriginalTotal);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const row of reservaRows) {
            const proporcion = totalHuespedActualCLP > 0 ? (row.valores?.valorHuesped || 0) / totalHuespedActualCLP : 1 / reservaRows.length;
            const nuevosValores = _calcularNuevosValoresReserva(row.valores || {}, proporcion, recalcGrupoUSD, nuevoTotalHuespedCLP, valorDolarUsado);
            const ediciones = { 'valores.valorHuesped': true, 'valores.valorTotal': true, 'valores.iva': true, 'valores.valorHuespedOriginal': true, 'valores.valorTotalOriginal': true, 'valores.ivaOriginal': true };
            await client.query(
                `UPDATE reservas SET valores = $1::jsonb, metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $3`,
                [JSON.stringify(nuevosValores), JSON.stringify({ edicionesManuales: { ...(row.metadata?.edicionesManuales || {}), ...ediciones } }), row.id]
            );
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const calcularPotencialGrupo = async (_db, empresaId, idsIndividuales, descuento) => {
    for (const id of idsIndividuales) {
        const { rows } = await pool.query('SELECT valores FROM reservas WHERE id = $1 AND empresa_id = $2', [id, empresaId]);
        if (!rows[0]) continue;
        const valorHuesped = rows[0].valores?.valorHuesped || 0;
        if (valorHuesped > 0 && descuento > 0 && descuento < 100) {
            const valorPotencial = Math.round(valorHuesped / (1 - parseFloat(descuento) / 100));
            await pool.query(
                `UPDATE reservas SET valores = valores || $1::jsonb, metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $3`,
                [JSON.stringify({ valorPotencial }), JSON.stringify({ potencialCalculado: true }), id]
            );
        }
    }
};

module.exports = { actualizarValoresGrupo, calcularPotencialGrupo };
