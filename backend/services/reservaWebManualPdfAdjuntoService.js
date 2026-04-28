/**
 * Descarga opcional del manual PDF público (HTTPS) para adjuntarlo al correo de confirmación.
 * Mitiga SSRF básico (solo https, host no loopback/privado) y limita tamaño.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_MS = 15000;

/**
 * @param {string} urlString
 * @returns {boolean}
 */
function esUrlDescargaPdfPermitida(urlString) {
    const t = String(urlString || '').trim();
    if (!t) return false;
    let u;
    try {
        u = new URL(t);
    } catch {
        return false;
    }
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (!h || h === 'localhost' || h.endsWith('.localhost')) return false;
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const m = h.match(ipv4);
    if (m) {
        const p = [1, 2, 3, 4].map((i) => parseInt(m[i], 10));
        if (p.some((n) => n > 255)) return false;
        const [a, b] = p;
        if (a === 10) return false;
        if (a === 127) return false;
        if (a === 0) return false;
        if (a === 169 && b === 254) return false;
        if (a === 192 && b === 168) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
    }
    return true;
}

function _filenameDesdeUrl(u) {
    const def = 'manual-huesped.pdf';
    try {
        const parts = u.pathname.split('/').filter(Boolean);
        const last = parts.pop() || '';
        const s = last.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
        if (s.toLowerCase().endsWith('.pdf')) return s;
        return def;
    } catch {
        return def;
    }
}

/**
 * @param {string} urlString
 * @returns {Promise<{ filename: string, content: Buffer } | null>}
 */
async function descargarAdjuntoManualPdfOpcional(urlString) {
    if (!esUrlDescargaPdfPermitida(urlString)) return null;
    let u;
    try {
        u = new URL(String(urlString).trim());
    } catch {
        return null;
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_MS);
    try {
        const res = await fetch(u.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: ac.signal,
            headers: {
                Accept: 'application/pdf,*/*;q=0.8',
                'User-Agent': 'StayManagerReservaWeb/1.0',
            },
        });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length || buf.length > MAX_BYTES) return null;
        if (!buf.subarray(0, 4).equals(Buffer.from('%PDF'))) return null;
        return { filename: _filenameDesdeUrl(u), content: buf };
    } catch (e) {
        console.warn('[manualPdfAdjunto] No se pudo descargar PDF:', e.message || e);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    esUrlDescargaPdfPermitida,
    descargarAdjuntoManualPdfOpcional,
    MAX_BYTES,
};
