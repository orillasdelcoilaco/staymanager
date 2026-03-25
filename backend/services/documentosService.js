// backend/services/documentosService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { deleteFileByUrl, uploadFile } = require('./storageService');
const path = require('path');

const actualizarDocumentoReserva = async (db, empresaId, idsIndividuales, tipoDocumento, url) => {
    const campoJson = tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva';

    if (url === null && idsIndividuales.length > 0) {
        if (pool) {
            const { rows } = await pool.query('SELECT documentos FROM reservas WHERE id = $1 AND empresa_id = $2', [idsIndividuales[0], empresaId]);
            const oldUrl = rows[0]?.documentos?.[campoJson];
            if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') deleteFileByUrl(oldUrl).catch(e => console.error(e.message));
        } else {
            const firstRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]);
            const firstDoc = await firstRef.get();
            if (firstDoc.exists) {
                const oldUrl = firstDoc.data().documentos?.[campoJson];
                if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') deleteFileByUrl(oldUrl).catch(e => console.error(e.message));
            }
        }
    }

    if (pool) {
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
        return;
    }

    // Firestore fallback
    const campo = `documentos.${campoJson}`;
    const batch = db.batch();
    const updateData = {};
    updateData[campo] = url === null ? admin.firestore.FieldValue.delete() : url;
    if (tipoDocumento === 'boleta' && (url || url === 'SIN_DOCUMENTO')) updateData.estadoGestion = 'Pendiente Cliente';
    idsIndividuales.forEach(id => {
        batch.update(db.collection('empresas').doc(empresaId).collection('reservas').doc(id), updateData);
    });
    await batch.commit();
};

const gestionarDocumentoReserva = async (db, empresaId, reservaId, tipoDocumento, archivo, accion) => {
    const campoJson = tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva';

    if (pool) {
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
    }

    // Firestore fallback
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) throw new Error('Reserva no encontrada');
    const reservaData = reservaDoc.data();
    const campo = `documentos.${campoJson}`;
    const oldUrl = reservaData.documentos?.[campoJson];
    if (accion === 'delete') {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') await deleteFileByUrl(oldUrl);
        await reservaRef.update({ [campo]: admin.firestore.FieldValue.delete() });
    } else if (archivo) {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') await deleteFileByUrl(oldUrl);
        const year = new Date().getFullYear();
        const fileName = `${reservaData.idReservaCanal}_${tipoDocumento}_${Date.now()}${path.extname(archivo.originalname)}`;
        const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
        const publicUrl = await uploadFile(archivo.buffer, destination, archivo.mimetype);
        await reservaRef.update({ [campo]: publicUrl });
    } else {
        throw new Error('Acción no válida o archivo no proporcionado.');
    }
    return (await reservaRef.get()).data();
};

module.exports = { actualizarDocumentoReserva, gestionarDocumentoReserva };
