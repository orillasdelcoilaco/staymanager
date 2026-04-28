/**
 * Acciones de panel sobre PII de check-in web (PostgreSQL).
 */

const pool = require('../db/postgres');
const {
    metadataTrasEliminarPiiCheckinIdentidad,
    metadataTrasActualizarCheckinIdentidadPanel,
} = require('./reservaWebCheckinIdentidadService');

/**
 * @param {string} empresaId
 * @param {string} reservaId UUID fila `reservas.id`
 * @param {string} [usuarioEmail] quien ejecuta (auditoría)
 * @returns {Promise<{ ok: boolean, changed: boolean }>}
 */
async function eliminarPiiCheckinIdentidadWebReserva(empresaId, reservaId, usuarioEmail) {
    const { rows } = await pool.query(
        'SELECT id, metadata FROM reservas WHERE id = $1 AND empresa_id = $2',
        [reservaId, empresaId],
    );
    if (!rows[0]) {
        const e = new Error('Reserva no encontrada.');
        e.statusCode = 404;
        throw e;
    }
    const { changed, metadata } = metadataTrasEliminarPiiCheckinIdentidad(rows[0].metadata, usuarioEmail);
    if (!changed) {
        return { ok: true, changed: false };
    }
    await pool.query(
        'UPDATE reservas SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3',
        [JSON.stringify(metadata), reservaId, empresaId],
    );
    return { ok: true, changed: true };
}

/**
 * @param {object} datosFormulario campos de identidad (documentoTipo, rut, documentoNumero, nacionalidadHuesped, fechaNacimientoHuesped)
 * @returns {Promise<{ ok: boolean, changed: boolean }>}
 */
async function actualizarCheckinIdentidadWebReserva(empresaId, reservaId, datosFormulario, usuarioEmail) {
    const { rows } = await pool.query(
        'SELECT id, metadata FROM reservas WHERE id = $1 AND empresa_id = $2',
        [reservaId, empresaId],
    );
    if (!rows[0]) {
        const e = new Error('Reserva no encontrada.');
        e.statusCode = 404;
        throw e;
    }
    const metadata = metadataTrasActualizarCheckinIdentidadPanel(
        rows[0].metadata,
        datosFormulario && typeof datosFormulario === 'object' ? datosFormulario : {},
        usuarioEmail,
    ).metadata;
    await pool.query(
        'UPDATE reservas SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3',
        [JSON.stringify(metadata), reservaId, empresaId],
    );
    return { ok: true, changed: true };
}

module.exports = {
    eliminarPiiCheckinIdentidadWebReserva,
    actualizarCheckinIdentidadWebReserva,
};
