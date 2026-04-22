/**
 * @fileoverview Photo Retrieval Service
 * Returns optimized photo URLs from PostgreSQL galeria table (primary) with fallback to propiedades.metadata.
 * SOLUCIÓN UNIFICADA: Prioriza la tabla galeria como fuente de verdad centralizada.
 */

const pool = require('../../db/postgres');

/**
 * Get photos for a specific property and type (optional).
 * @param {object} _db - unused (legacy param)
 * @param {string} empresaId
 * @param {string} alojamientoId
 * @param {string} tipo - optional filter like "dormitorio", "baño"
 */
async function getMorePhotos(_db, empresaId, alojamientoId, tipo = null) {
    try {
        // ============================================================
        // PRIORIDAD 1: TABLA GALERIA (fuente de verdad centralizada)
        // ============================================================
        let query = `
            SELECT storage_url, alt_text, espacio, espacio_id, confianza, estado
            FROM galeria
            WHERE empresa_id = $1 AND propiedad_id = $2
              AND estado IN ('auto', 'manual')
        `;
        const params = [empresaId, alojamientoId];

        if (tipo) {
            // Buscar en espacio o alt_text
            query += ` AND (espacio ILIKE $${params.length + 1} OR alt_text ILIKE $${params.length + 1})`;
            params.push(`%${tipo}%`);
        }

        query += ' ORDER BY confianza DESC, orden ASC LIMIT 10';

        const { rows: galeriaRows } = await pool.query(query, params);

        if (galeriaRows.length > 0) {
            // Tenemos fotos en la galería
            const fotos = galeriaRows.slice(0, 5).map(row => ({
                url: row.storage_url,
                altText: row.alt_text || '',
                espacio: row.espacio || '',
                confianza: row.confianza
            }));
            return { tipo: tipo || "general", fotos, fuente: "galeria" };
        }

        // ============================================================
        // PRIORIDAD 2: FALLBACK A websiteData.images (legacy)
        // ============================================================
        const { rows } = await pool.query(
            'SELECT metadata FROM propiedades WHERE id = $1 AND empresa_id = $2',
            [alojamientoId, empresaId]
        );
        if (!rows[0]) return { error: "Alojamiento no encontrado" };

        const websiteImages = rows[0].metadata?.websiteData?.images || {};
        let allImages = [];
        Object.values(websiteImages).forEach(imgArray => {
            if (Array.isArray(imgArray)) allImages.push(...imgArray);
        });

        if (tipo) {
            const regex = new RegExp(tipo, 'i');
            const filtered = allImages.filter(img =>
                (img.title && regex.test(img.title)) ||
                (img.altText && regex.test(img.altText))
            );
            if (filtered.length > 0) allImages = filtered;
        }

        const limited = allImages.slice(0, 5).map(img => ({
            url: img.storagePath,
            altText: img.altText || '',
            espacio: img.title || '',
            confianza: 0.5 // Confianza baja para datos legacy
        }));
        return { tipo: tipo || "general", fotos: limited, fuente: "websiteData" };

    } catch (error) {
        console.error("Error getting photos:", error);
        return { error: error.message };
    }
}

module.exports = { getMorePhotos };
