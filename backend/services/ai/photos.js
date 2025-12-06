/**
 * @fileoverview Photo Retrieval Service
 * returns optimized photo URLs without vision processing/metadata overkill.
 */

const { COLLECTIONS } = require('../../firestore/models');

/**
 * Get photos for a specific property and type (optional).
 * @param {object} db 
 * @param {string} empresaId 
 * @param {string} alojamientoId 
 * @param {string} tipo (optional filter like "dormitorio", "baño")
 */
async function getMorePhotos(db, empresaId, alojamientoId, tipo = null) {
    try {
        const docRef = db.collection(COLLECTIONS.EMPRESAS)
            .doc(empresaId)
            .collection(COLLECTIONS.PROPIEDADES)
            .doc(alojamientoId);

        const doc = await docRef.get();
        if (!doc.exists) return { error: "Alojamiento no encontrado" };

        const data = doc.data();
        let allImages = [];

        // Aggregate all images from websiteData
        if (data.websiteData?.images) {
            Object.values(data.websiteData.images).forEach(imgArray => {
                if (Array.isArray(imgArray)) {
                    allImages.push(...imgArray);
                }
            });
        }

        // TODO: Filter by 'tipo' if our image metadata supports categorization mapping.
        // For now, if 'tipo' is requested, we assume images stored in components might match,
        // but 'websiteData.images' is often keyed by componentId. 
        // We'll perform a simple text match on 'title' or 'altText' if available, or just return first few.

        if (tipo) {
            const regex = new RegExp(tipo, 'i');
            const filtered = allImages.filter(img =>
                (img.title && regex.test(img.title)) ||
                (img.altText && regex.test(img.altText))
            );

            // If we found matches, use them. Otherwise fallback to all (better something than nothing).
            if (filtered.length > 0) {
                allImages = filtered;
            }
        }

        // Limit to 5 images to avoid overwhelming the chat
        const limited = allImages.slice(0, 5).map(img => ({
            url: img.storagePath // In real app, generate signed URL if private, but these are public assets
        }));

        return {
            tipo: tipo || "general",
            fotos: limited
        };

    } catch (error) {
        console.error("Error getting photos:", error);
        return { error: error.message };
    }
}

module.exports = {
    getMorePhotos
};
