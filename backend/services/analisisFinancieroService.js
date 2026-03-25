// backend/services/analisisFinancieroService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');
const { registrarAjusteValor } = require('./utils/trazabilidadService');

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

const actualizarValoresGrupo = async (db, empresaId, usuarioEmail, valoresCabanas, nuevoTotalHuesped) => {
    const ids = valoresCabanas.map(i => i.id);

    if (pool) {
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
        return;
    }

    // Firestore fallback
    const docs = await Promise.all(ids.map(id => db.collection('empresas').doc(empresaId).collection('reservas').doc(id).get()));
    if (!docs.length || !docs[0].exists) throw new Error('No se encontraron las reservas para actualizar.');

    const primera  = docs[0].data();
    const moneda   = primera.moneda || 'CLP';
    const canalId  = primera.canalId;
    const totalHuespedActualCLP = docs.reduce((s, d) => s + (d.data().valores?.valorHuesped || 0), 0);
    const comisionOriginalTotal = docs.reduce((s, d) => s + (d.data().valores?.comisionOriginal || 0), 0);
    const valorDolarUsado = await _determinarValorDolarGrupo(db, empresaId, primera);
    const nuevoTotalHuespedCLP = parseFloat(nuevoTotalHuesped);
    const nuevoTotalUSD = (moneda !== 'CLP' && valorDolarUsado > 0) ? nuevoTotalHuespedCLP / valorDolarUsado : nuevoTotalHuespedCLP;

    const canalDoc = await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).get();
    const configuracionIva = canalDoc.exists ? (canalDoc.data().configuracionIva || 'incluido') : 'incluido';
    const recalcGrupoUSD = recalcularValoresDesdeTotal(nuevoTotalUSD, configuracionIva, comisionOriginalTotal);

    await db.runTransaction(async (transaction) => {
        for (const doc of docs) {
            const reserva = doc.data();
            const proporcion = totalHuespedActualCLP > 0 ? (reserva.valores?.valorHuesped || 0) / totalHuespedActualCLP : 1 / docs.length;
            const nuevosValores = _calcularNuevosValoresReserva(reserva.valores || {}, proporcion, recalcGrupoUSD, nuevoTotalHuespedCLP, valorDolarUsado);
            const valorAnteriorUSD = (reserva.valores?.valorHuespedOriginal || 0);
            await registrarAjusteValor(transaction, db, empresaId, doc.ref, { fuente: 'Gestión Diaria (Ajustar Cobro)', usuarioEmail, valorAnteriorUSD, valorNuevoUSD: nuevosValores.valorHuespedOriginal, valorDolarUsado });
            transaction.update(doc.ref, {
                valores: nuevosValores,
                'edicionesManuales.valores.valorHuesped': true, 'edicionesManuales.valores.valorTotal': true,
                'edicionesManuales.valores.iva': true, 'edicionesManuales.valores.valorHuespedOriginal': true,
                'edicionesManuales.valores.valorTotalOriginal': true, 'edicionesManuales.valores.ivaOriginal': true,
            });
        }
    });
};

const calcularPotencialGrupo = async (db, empresaId, idsIndividuales, descuento) => {
    if (pool) {
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
        return;
    }

    // Firestore fallback
    const batch = db.batch();
    for (const id of idsIndividuales) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        const doc = await ref.get();
        if (doc.exists) {
            const valorHuesped = doc.data().valores?.valorHuesped || 0;
            if (valorHuesped > 0 && descuento > 0 && descuento < 100) {
                const valorPotencial = Math.round(valorHuesped / (1 - parseFloat(descuento) / 100));
                batch.update(ref, { 'valores.valorPotencial': valorPotencial, 'edicionesManuales.valores.valorPotencial': true, potencialCalculado: true });
            }
        }
    }
    await batch.commit();
};

module.exports = { actualizarValoresGrupo, calcularPotencialGrupo };
