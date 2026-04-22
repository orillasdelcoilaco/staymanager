/**
 * @fileoverview availability filtering service
 * Queries PostgreSQL for available properties based on capacity and location.
 */

const pool = require('../../db/postgres');

/**
 * Filters availability.
 * @param {object} _db - unused (Firestore legacy param)
 * @param {string} empresaId
 * @param {object} criteria - { fechas, personas, ubicacion }
 * @returns {Promise<object>} Availability Object for AI
 */
async function checkAvailability(_db, empresaId, criteria = {}) {
    try {
        const { rows } = await pool.query(
            'SELECT id, nombre, capacidad, metadata FROM propiedades WHERE empresa_id = $1 AND activo = true',
            [empresaId]
        );

        if (!rows.length) return { empresa: empresaId, opciones: [] };

        const paxRequest = criteria.personas || 1;
        let opciones = [];

        for (const row of rows) {
            const cap = row.capacidad || 0;
            if (cap < paxRequest) continue;

            const meta = row.metadata || {};

            if (criteria.ubicacion) {
                const locProp = meta.ubicacion || meta.infoBase?.ubicacion;
                let locString = '';
                if (typeof locProp === 'string') {
                    locString = locProp;
                } else if (locProp && typeof locProp === 'object') {
                    locString = [locProp.address, locProp.city, locProp.direccion, locProp.ciudad, locProp.region]
                        .filter(p => p && typeof p === 'string').join(' ');
                }
                if (!locString.toLowerCase().includes(criteria.ubicacion.toLowerCase())) continue;
            }

            const websiteData = meta.websiteData || {};
            const images = [];
            const mainImg = websiteData.cardImage?.storagePath || websiteData.images?.['general']?.[0]?.storagePath;
            if (mainImg) images.push({ tipo: 'principal', url: mainImg });
            const interiorImg = websiteData.images?.['interior']?.[0]?.storagePath || websiteData.images?.['dormitorio']?.[0]?.storagePath;
            if (interiorImg && interiorImg !== mainImg) images.push({ tipo: 'interior', url: interiorImg });

            opciones.push({
                id: row.id,
                nombre: row.nombre,
                precio_noche: meta.tarifas?.base || 0,
                capacidad: cap,
                preview: images.slice(0, 2),
                link_reserva: `https://${empresaId}.suitemanagers.com/propiedad/${row.id}`,
            });
        }

        return { empresa: empresaId, opciones: opciones.slice(0, 5) };
    } catch (error) {
        console.error('Error in checkAvailability:', error);
        return { error: error.message };
    }
}

module.exports = { checkAvailability };
