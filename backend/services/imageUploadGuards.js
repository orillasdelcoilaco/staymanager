// backend/services/imageUploadGuards.js
// Reglas estrictas para subidas: full + thumb obligatorios; rollback en Storage si falla la persistencia.

const { deleteFileByPath } = require('./storageService');

const MIN_BYTES_WEBP = 80;

/**
 * @param {Buffer[]} buffers
 */
function assertOptimizedBuffers(buffers) {
    for (const b of buffers) {
        if (!Buffer.isBuffer(b) || b.length < MIN_BYTES_WEBP) {
            const err = new Error(
                'La imagen no se pudo procesar correctamente. Usa JPG o PNG válido (máx. recomendado 25 MB) e inténtalo de nuevo.'
            );
            err.statusCode = 400;
            throw err;
        }
    }
}

/**
 * URLs públicas de Storage deben existir y ser distintas (full vs miniatura).
 * @param {string} fullUrl
 * @param {string} thumbUrl
 */
function assertDistinctPublicUrls(fullUrl, thumbUrl) {
    const a = String(fullUrl || '').trim();
    const b = String(thumbUrl || '').trim();
    if (!a || !b || a === b) {
        const err = new Error('No se generó la miniatura obligatoria para la imagen. Elige otro archivo.');
        err.statusCode = 422;
        throw err;
    }
}

/**
 * @param {string[]} urls
 */
async function rollbackPublicUrls(urls) {
    const list = Array.isArray(urls) ? urls : [];
    for (const u of list) {
        if (u) await deleteFileByPath(u).catch(() => {});
    }
}

module.exports = {
    assertOptimizedBuffers,
    assertDistinctPublicUrls,
    rollbackPublicUrls,
    MIN_BYTES_WEBP,
};
