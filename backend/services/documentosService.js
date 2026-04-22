// backend/services/documentosService.js
const pool = require('../db/postgres');
const { deleteFileByUrl, uploadFile } = require('./storageService');
const path = require('path');

const actualizarDocumentoReserva = async (_db, empresaId, idsIndividuales, tipoDocumento, url) => {
    const campoJson = tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva';

    if (url === null && idsIndividuales.length > 0) {
        const { rows } = await pool.query('SELECT documentos FROM reservas WHERE id = $1 AND empresa_id = $2', [idsIndividuales[0], empresaId]);
        const oldUrl = rows[0]?.documentos?.[campoJson];
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') deleteFileByUrl(oldUrl).catch(e => console.error(e.message));
    }

    const estadoGestionSet = tipoDocumento === 'boleta' && (url || url === 'SIN_DOCUMENTO');
    for (const id of idsIndividuales) {
        if (url === null) {
            await pool.query(
                `UPDATE reservas SET documentos = documentos - $1, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                [campoJson, id, empresaId]
            );
        } else {
            const patch = JSON.stringify({ [campoJson]: url });
            if (estadoGestionSet) {
                await pool.query(
                    `UPDATE reservas SET documentos = documentos || $1::jsonb, estado_gestion = 'Pendiente Cliente', updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                    [patch, id, empresaId]
                );
            } else {
                await pool.query(
                    `UPDATE reservas SET documentos = documentos || $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                    [patch, id, empresaId]
                );
            }
        }
    }
};

const gestionarDocumentoReserva = async (_db, empresaId, reservaId, tipoDocumento, archivo, accion) => {
    const campoJson = tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva';
    const { rows } = await pool.query('SELECT * FROM reservas WHERE id = $1 AND empresa_id = $2', [reservaId, empresaId]);
    if (!rows[0]) throw new Error('Reserva no encontrada');
    const reservaData = rows[0];
    const oldUrl = reservaData.documentos?.[campoJson];

    if (accion === 'delete') {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') await deleteFileByUrl(oldUrl);
        await pool.query(`UPDATE reservas SET documentos = documentos - $1, updated_at = NOW() WHERE id = $2`, [campoJson, reservaId]);
    } else if (archivo) {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') await deleteFileByUrl(oldUrl);
        const year = new Date().getFullYear();
        const fileName = `${reservaData.id_reserva_canal}_${tipoDocumento}_${Date.now()}${path.extname(archivo.originalname)}`;
        const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
        const publicUrl = await uploadFile(archivo.buffer, destination, archivo.mimetype);
        await pool.query(`UPDATE reservas SET documentos = documentos || $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify({ [campoJson]: publicUrl }), reservaId]);
    } else {
        throw new Error('Acción no válida o archivo no proporcionado.');
    }
    const { rows: updated } = await pool.query('SELECT * FROM reservas WHERE id = $1', [reservaId]);
    return updated[0];
};

module.exports = { actualizarDocumentoReserva, gestionarDocumentoReserva };
