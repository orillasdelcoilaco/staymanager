/**
 * URL de imagen directa para feeds Google (no páginas HTML de alojamiento).
 * Usa galería / websiteData si linkFotos apunta a una ficha o path sin extensión de imagen.
 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i;

function isLikelyDirectImageUrl(url) {
    const s = String(url || '').trim();
    if (!s) return false;
    if (!/^https?:\/\//i.test(s)) return false;
    const pathNoQuery = s.split('?')[0].split('#')[0];
    if (pathNoQuery.endsWith('/')) return false;
    if (IMAGE_EXT.test(s)) return true;
    if (/firebasestorage\.googleapis\.com|supabase\.co\/storage|googleusercontent\.com|cloudinary\.com/i.test(s)) {
        return true;
    }
    return false;
}

function pickFromWebsiteDataImages(meta) {
    const m = meta && typeof meta === 'object' ? meta : {};
    const wd = m.websiteData && typeof m.websiteData === 'object' ? m.websiteData : {};
    const card = wd.cardImage && typeof wd.cardImage === 'object' ? wd.cardImage : null;
    if (card?.storagePath) {
        const p = String(card.storagePath).trim();
        if (p) return p;
    }
    const images = wd.images && typeof wd.images === 'object' ? wd.images : {};
    const portada = images.portadaRecinto?.[0] || images.exteriorAlojamiento?.[0];
    if (portada?.storagePath) {
        const p = String(portada.storagePath).trim();
        if (p) return p;
    }
    const flat = Object.values(images).filter(Array.isArray).flat();
    if (flat[0]?.storagePath) {
        return String(flat[0].storagePath).trim() || null;
    }
    return null;
}

/**
 * @param {{ metadata?: object }|null} rowOrMeta - fila con metadata o metadata pura
 * @param {string|null|undefined} galeriaStorageUrl - primer storage_url de galería (Postgres), si ya se resolvió
 * @returns {string|null}
 */
function resolveFeedPrimaryImageUrl(rowOrMeta, galeriaStorageUrl) {
    const meta = rowOrMeta?.metadata && typeof rowOrMeta.metadata === 'object'
        ? rowOrMeta.metadata
        : (rowOrMeta && typeof rowOrMeta === 'object' && !rowOrMeta.metadata
            ? rowOrMeta
            : rowOrMeta?.metadata || {});
    const m = meta && typeof meta === 'object' ? meta : {};
    const link = m.linkFotos ? String(m.linkFotos).trim() : '';
    if (link && isLikelyDirectImageUrl(link)) return link;
    const fromSite = pickFromWebsiteDataImages(m);
    if (fromSite) return fromSite;
    if (galeriaStorageUrl) {
        const g = String(galeriaStorageUrl).trim();
        if (g) return g;
    }
    if (link && !isLikelyDirectImageUrl(link)) {
        return null;
    }
    return link || null;
}

module.exports = {
    isLikelyDirectImageUrl,
    resolveFeedPrimaryImageUrl,
    pickFromWebsiteDataImages,
};
