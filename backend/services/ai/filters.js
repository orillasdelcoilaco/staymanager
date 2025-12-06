/**
 * @fileoverview availability filtering service - Final
 * Efficiently queries Firestore for available properties based on capacity and LOCATION.
 */

const { COLLECTIONS } = require('../../firestore/models');

/**
 * Filters availability.
 * @param {object} db - Firestore instance
 * @param {string} empresaId 
 * @param {object} criteria - { fechas, personas, ubicacion }
 * @returns {Promise<object>} Availability Object for AI
 */
async function checkAvailability(db, empresaId, criteria = {}) {
    try {
        const propsRef = db.collection(COLLECTIONS.EMPRESAS).doc(empresaId).collection(COLLECTIONS.PROPIEDADES);
        let query = propsRef;

        const snapshot = await query.get();
        if (snapshot.empty) {
            return {
                empresa: empresaId,
                opciones: []
            };
        }

        let opciones = [];
        const paxRequest = criteria.personas || 1;

        snapshot.forEach(doc => {
            const data = doc.data();
            const cap = data.infoBase?.capacidad || 0;

            // Filter: Capacity >= Requested Pax
            if (cap >= paxRequest) {
                // Filter: Location (if requested)
                // This logic ensures "Pucón", "Santiago", etc are respected.
                if (criteria.ubicacion) {
                    const locProp = data.infoBase?.ubicacion;
                    let locString = "";

                    if (typeof locProp === 'string') {
                        locString = locProp;
                    } else if (typeof locProp === 'object' && locProp !== null) {
                        // Check common fields: address, city, region
                        const parts = [
                            locProp.address,
                            locProp.city,
                            locProp.direccion,
                            locProp.ciudad,
                            locProp.region
                        ];
                        locString = parts.filter(p => p && typeof p === 'string').join(" ");
                    }

                    // Simple "includes" check (Case Insensitive)
                    if (!locString.toLowerCase().includes(criteria.ubicacion.toLowerCase())) {
                        return; // Skip this property -> Does not match requested location
                    }
                }

                // Image strategy: Get main image, maybe one more.
                const images = [];
                const mainImg = data.websiteData?.cardImage?.storagePath || data.websiteData?.images?.['general']?.[0]?.storagePath;
                if (mainImg) images.push({ tipo: 'principal', url: mainImg });

                // Try to find a second one (e.g. interior)
                const interiorImg = data.websiteData?.images?.['interior']?.[0]?.storagePath || data.websiteData?.images?.['dormitorio']?.[0]?.storagePath;
                if (interiorImg && interiorImg !== mainImg) images.push({ tipo: 'interior', url: interiorImg });

                opciones.push({
                    id: doc.id,
                    nombre: data.infoBase?.nombre || 'Alojamiento',
                    precio_noche: data.tarifas?.base || 0, // Should be number
                    capacidad: cap,
                    preview: images.slice(0, 2), // Max 2 photos as requested
                    link_reserva: `https://${empresaId}.suitemanagers.com/propiedad/${doc.id}` // Full URL for Global
                });
            }
        });

        // Limit options
        opciones = opciones.slice(0, 5);

        return {
            empresa: empresaId,
            opciones: opciones
        };

    } catch (error) {
        console.error("Error in checkAvailability:", error);
        return { error: error.message };
    }
}

module.exports = {
    checkAvailability
};
