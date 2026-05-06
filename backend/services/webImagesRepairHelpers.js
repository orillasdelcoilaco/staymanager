/**
 * Utilidades compartidas repair web (Storage URLs públicas Firebase).
 */
const fetch = require('node-fetch');

function storagePathFromPublicUrl(url) {
    const s = String(url || '').trim();
    if (!s || !s.includes('/o/')) return '';
    const pathPart = s.split('/o/')[1].split('?')[0];
    try {
        return decodeURIComponent(pathPart);
    } catch {
        return '';
    }
}

function thumbPathFromFullStoragePath(fullPath) {
    const p = String(fullPath || '').trim();
    if (!p.toLowerCase().endsWith('.webp')) return '';
    if (p.toLowerCase().includes('_thumb.webp')) return '';
    return p.replace(/\.webp$/i, '_thumb.webp');
}

function thumbUrlLooksValid(fullUrl, thumbUrl) {
    const f = String(fullUrl || '').trim();
    const t = String(thumbUrl || '').trim();
    return Boolean(f && t && f !== t);
}

async function fetchImageBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('vacío');
    return buf;
}

module.exports = {
    storagePathFromPublicUrl,
    thumbPathFromFullStoragePath,
    thumbUrlLooksValid,
    fetchImageBuffer,
};
