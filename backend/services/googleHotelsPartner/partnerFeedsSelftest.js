/**
 * Prueba HTTP servida → feeds partner globales (misma lógica que smoke CLI).
 * Usa token solo desde env del servidor; no expone el secreto en respuestas JSON.
 */
const https = require('https');
const http = require('http');

function httpGet(urlStr) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.get(urlStr, { headers: { 'User-Agent': 'StayManager-partner-selftest/1' } }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: Buffer.concat(chunks).toString('utf8'),
                });
            });
        });
        req.on('error', reject);
        req.setTimeout(120000, () => {
            req.destroy(new Error('timeout'));
        });
    });
}

function resolveSelftestBaseUrl() {
    const explicit = String(
        process.env.GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL
        || process.env.GH_PARTNER_FEED_BASE_URL
        || '',
    ).trim().replace(/\/$/, '');
    if (explicit) return explicit;
    const platform = (process.env.PLATFORM_DOMAIN || 'rezerva.cl').toLowerCase();
    return `https://feeds.${platform}`;
}

function buildPartnerFeedUrlsForDisplay() {
    const base = resolveSelftestBaseUrl();
    const platform = (process.env.PLATFORM_DOMAIN || 'rezerva.cl').toLowerCase();
    return {
        selftestBaseUrl: base,
        platformDomain: platform,
        propertiesUrlTemplate: `${base}/feeds/google/properties.xml?auth=(token en servidor / Render)`,
        ariUrlTemplate: `${base}/feeds/google/ari.xml?auth=(token en servidor / Render)`,
        hint: 'En Render suele hacer falta GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL o GH_PARTNER_FEED_BASE_URL si el host público no es feeds.<plataforma>.',
    };
}

/**
 * GET públicas hacia el mismo despliegue (Host permitido en partner router).
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, baseUrl: string, checks: object[], lastError?: string }>}
 */
async function runGooglePartnerFeedsSelftest() {
    const token = String(process.env.GOOGLE_PARTNER_FEED_AUTH_TOKEN || '').trim();
    if (!token || token.length < 16) {
        return {
            ok: false,
            skipped: true,
            reason: 'GOOGLE_PARTNER_FEED_AUTH_TOKEN no configurado o demasiado corto en el servidor',
            baseUrl: resolveSelftestBaseUrl(),
            checks: [],
        };
    }

    const base = resolveSelftestBaseUrl();
    const paths = ['/feeds/google/properties.xml', '/feeds/google/ari.xml'];
    const q = `auth=${encodeURIComponent(token)}`;
    const checks = [];

    for (const p of paths) {
        const url = `${base}${p}?${q}`;
        try {
            const { status, body } = await httpGet(url);
            const xmlOk = /<\?xml/i.test(body) || /<Transaction[\s>]/i.test(body);
            checks.push({
                path: p,
                httpStatus: status,
                xmlLikelyOk: xmlOk,
                bytes: body.length,
            });
            if (status !== 200 || !xmlOk) {
                return {
                    ok: false,
                    skipped: false,
                    baseUrl: base,
                    checks,
                    lastError: `HTTP ${status} o XML no reconocido en ${p}`,
                };
            }
        } catch (e) {
            return {
                ok: false,
                skipped: false,
                baseUrl: base,
                checks,
                lastError: `${p}: ${e.message}`,
            };
        }
    }

    return { ok: true, skipped: false, baseUrl: base, checks };
}

module.exports = {
    runGooglePartnerFeedsSelftest,
    buildPartnerFeedUrlsForDisplay,
    resolveSelftestBaseUrl,
};
