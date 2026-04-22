// backend/services/transaccionesService.js
const pool = require('../db/postgres');
const { deleteFileByUrl } = require('./storageService');

const registrarPago = async (_db, empresaId, detalles) => {
    const { idsIndividuales, monto, medioDePago, esPagoFinal, enlaceComprobante, reservaIdOriginal } = detalles;
    await pool.query(
        `INSERT INTO transacciones (empresa_id, id_reserva_canal, tipo, monto, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            empresaId,
            reservaIdOriginal,
            esPagoFinal ? 'Pago Final' : 'Abono',
            parseFloat(monto),
            JSON.stringify({ medioDePago, enlaceComprobante: enlaceComprobante || null })
        ]
    );
    if (esPagoFinal && idsIndividuales?.length) {
        await pool.query(
            `UPDATE reservas SET estado_gestion = 'Pendiente Boleta', updated_at = NOW()
             WHERE id = ANY($1) AND empresa_id = $2`,
            [idsIndividuales, empresaId]
        );
    }
};

const eliminarPago = async (_db, empresaId, transaccionId) => {
    const { rows } = await pool.query(
        'SELECT tipo, metadata, id_reserva_canal FROM transacciones WHERE id = $1 AND empresa_id = $2',
        [transaccionId, empresaId]
    );
    if (!rows[0]) throw new Error('La transacción a eliminar no fue encontrada.');
    const { tipo, metadata, id_reserva_canal } = rows[0];
    const enlace = metadata?.enlaceComprobante;
    if (enlace && enlace !== 'SIN_DOCUMENTO') {
        await deleteFileByUrl(enlace).catch(err => console.error(`Fallo al eliminar comprobante: ${err.message}`));
    }
    await pool.query('DELETE FROM transacciones WHERE id = $1 AND empresa_id = $2', [transaccionId, empresaId]);
    if (tipo === 'Pago Final' && id_reserva_canal) {
        await pool.query(
            `UPDATE reservas SET estado_gestion = 'Pendiente Pago', updated_at = NOW()
             WHERE empresa_id = $1 AND id_reserva_canal = $2`,
            [empresaId, id_reserva_canal]
        );
    }
};

module.exports = { registrarPago, eliminarPago };
