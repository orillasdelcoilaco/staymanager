// backend/services/transaccionesService.js
const pool = require('../db/postgres');
const { deleteFileByUrl } = require('./storageService');

const MEDIOS_PAGO_PERMITIDOS = new Set([
    'Efectivo',
    'Transferencia',
    'Tarjeta Débito (POS externo)',
    'Tarjeta Crédito (POS externo)',
]);

const MEDIOS_PAGO_CATALOGO = [
    { value: 'Efectivo', requiereComprobanteSugerido: false },
    { value: 'Transferencia', requiereComprobanteSugerido: true },
    { value: 'Tarjeta Débito (POS externo)', requiereComprobanteSugerido: true },
    { value: 'Tarjeta Crédito (POS externo)', requiereComprobanteSugerido: true },
];

function _normalizarMedioDePago(raw) {
    const val = String(raw || '').trim();
    if (!val) return '';
    if (/^tarjeta$/i.test(val)) return 'Tarjeta Débito (POS externo)';
    if (/^debito$/i.test(val)) return 'Tarjeta Débito (POS externo)';
    if (/^credito$/i.test(val)) return 'Tarjeta Crédito (POS externo)';
    if (/^tarjeta debito/i.test(val)) return 'Tarjeta Débito (POS externo)';
    if (/^tarjeta credito/i.test(val)) return 'Tarjeta Crédito (POS externo)';
    if (/^transferencia/i.test(val)) return 'Transferencia';
    if (/^efectivo/i.test(val)) return 'Efectivo';
    return val;
}

function getMediosPagoManualesCatalogo() {
    return MEDIOS_PAGO_CATALOGO.map((x) => ({ ...x }));
}

function medioDePagoRequiereComprobanteSugerido(medio) {
    const normalizado = _normalizarMedioDePago(medio);
    const item = MEDIOS_PAGO_CATALOGO.find((x) => x.value === normalizado);
    return !!item?.requiereComprobanteSugerido;
}

const registrarPago = async (_db, empresaId, detalles) => {
    const {
        idsIndividuales,
        monto,
        medioDePago,
        esPagoFinal,
        enlaceComprobante,
        reservaIdOriginal,
        requiereComprobanteSugerido,
        observacion,
    } = detalles;
    const medioNormalizado = _normalizarMedioDePago(medioDePago);
    if (!MEDIOS_PAGO_PERMITIDOS.has(medioNormalizado)) {
        const err = new Error('Medio de pago no permitido. Usa: Efectivo, Transferencia, Tarjeta Débito (POS externo) o Tarjeta Crédito (POS externo).');
        err.statusCode = 400;
        throw err;
    }
    await pool.query(
        `INSERT INTO transacciones (empresa_id, id_reserva_canal, tipo, monto, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            empresaId,
            reservaIdOriginal,
            esPagoFinal ? 'Pago Final' : 'Abono',
            parseFloat(monto),
            JSON.stringify({
                medioDePago: medioNormalizado,
                enlaceComprobante: enlaceComprobante || null,
                requiereComprobanteSugerido: !!requiereComprobanteSugerido,
                observacion: String(observacion || '').trim().slice(0, 200),
            })
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

module.exports = {
    registrarPago,
    eliminarPago,
    getMediosPagoManualesCatalogo,
    medioDePagoRequiereComprobanteSugerido,
};
