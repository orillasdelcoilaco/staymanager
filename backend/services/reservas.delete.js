// backend/services/reservas.delete.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

function _tieneDocumentos(documentos) {
    return documentos && (documentos.enlaceReserva || documentos.enlaceBoleta);
}

function _extractStoragePath(url) {
    if (!url || url === 'SIN_DOCUMENTO') return null;
    if (url.includes('firebasestorage.googleapis.com')) {
        const m = url.match(/\/o\/(.+?)(\?|$)/);
        return m ? decodeURIComponent(m[1]) : null;
    }
    if (url.includes('storage.googleapis.com')) {
        const parts = new URL(url).pathname.split('/');
        parts.shift(); parts.shift(); // remove '' and bucket
        return parts.join('/') || null;
    }
    return null;
}

async function _eliminarArchivosStorage(urls) {
    const bucket = admin.storage().bucket();
    let eliminados = 0, errores = 0;
    for (const url of urls) {
        const filePath = _extractStoragePath(url);
        if (!filePath) continue;
        try {
            const file = bucket.file(filePath);
            const [exists] = await file.exists();
            if (exists) { await file.delete(); eliminados++; }
            else errores++;
        } catch (e) {
            console.error(`[ERROR] Storage delete ${filePath}:`, e.message);
            errores++;
        }
    }
    return { eliminados, errores };
}

async function _decidirYEliminarReservaPG(empresaId, reservaId) {
    const { rows } = await pool.query('SELECT * FROM reservas WHERE id = $1 AND empresa_id = $2', [reservaId, empresaId]);
    if (!rows[0]) throw new Error('Reserva no encontrada.');
    const row = rows[0];
    const idReservaCanal = row.id_reserva_canal;

    if (!idReservaCanal) {
        if (_tieneDocumentos(row.documentos)) {
            const err = new Error('Esta reserva tiene documentos asociados. Solo se puede eliminar el grupo completo.');
            err.code = 409;
            err.data = { idReservaCanal: reservaId, message: 'Esta reserva tiene documentos adjuntos.', grupoInfo: [{ id: reservaId, nombre: row.alojamiento_nombre, valor: row.valores?.valorHuesped || 0 }] };
            throw err;
        }
        await pool.query('DELETE FROM reservas WHERE id = $1', [reservaId]);
        return { status: 'individual_deleted', message: 'Reserva individual sin grupo eliminada.' };
    }

    const [transRes, notasRes, grupoRes] = await Promise.all([
        pool.query('SELECT id FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2 LIMIT 1', [empresaId, idReservaCanal]),
        pool.query('SELECT id FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = $2 LIMIT 1', [empresaId, idReservaCanal]),
        pool.query('SELECT id, alojamiento_nombre, documentos, valores FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]),
    ]);

    const tienePagosONotas      = transRes.rows.length > 0 || notasRes.rows.length > 0;
    const algunaConDocumentos   = grupoRes.rows.some(r => _tieneDocumentos(r.documentos));
    const estaLimpia            = !tienePagosONotas && !algunaConDocumentos;

    if (estaLimpia) {
        await pool.query('DELETE FROM reservas WHERE id = $1', [reservaId]);
        return { status: 'individual_deleted', message: 'Reserva individual eliminada de un grupo limpio.' };
    }

    const grupoInfo = grupoRes.rows.map(r => ({ id: r.id, nombre: r.alojamiento_nombre, valor: r.valores?.valorHuesped || 0 }));
    const err = new Error('Esta reserva tiene datos (pagos/notas/documentos) asociados. Solo se puede eliminar el grupo completo.');
    err.code = 409;
    err.data = { idReservaCanal, message: 'Esta reserva es parte de un grupo con datos vinculados.', grupoInfo };
    throw err;
}

async function _eliminarGrupoReservasCascadaPG(empresaId, idReservaCanal) {
    const [reservasRes, transRes] = await Promise.all([
        pool.query('SELECT documentos FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]),
        pool.query('SELECT metadata FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]),
    ]);

    const urlsStorage = [];
    for (const r of reservasRes.rows) {
        if (r.documentos?.enlaceReserva) urlsStorage.push(r.documentos.enlaceReserva);
        if (r.documentos?.enlaceBoleta)  urlsStorage.push(r.documentos.enlaceBoleta);
    }
    for (const t of transRes.rows) {
        const enlace = t.metadata?.enlaceComprobante;
        if (enlace && enlace !== 'SIN_DOCUMENTO') urlsStorage.push(enlace);
    }

    const storage = await _eliminarArchivosStorage(urlsStorage);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM bitacora      WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]);
        await client.query('DELETE FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]);
        const del = await client.query('DELETE FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2', [empresaId, idReservaCanal]);
        await client.query('COMMIT');
        return { status: 'group_deleted', deletedReservas: del.rowCount, storage };
    } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Error al eliminar el grupo: ${e.message}`);
    } finally {
        client.release();
    }
}

const decidirYEliminarReserva = async (_db, empresaId, reservaId) => {
    return _decidirYEliminarReservaPG(empresaId, reservaId);
};

const eliminarGrupoReservasCascada = async (_db, empresaId, idReservaCanal) => {
    try {
        return await _eliminarGrupoReservasCascadaPG(empresaId, idReservaCanal);
    } catch (error) {
        if (error.code === 409) throw error;
        throw new Error(`Error al eliminar el grupo: ${error.message}`);
    }
};

module.exports = { decidirYEliminarReserva, eliminarGrupoReservasCascada };
