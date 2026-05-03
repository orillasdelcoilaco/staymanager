/**
 * Smoke HTTP contra feeds globales partner (sin levantar servidor local).
 * Requiere host permitido por googleHotelsPartner.routes (feeds./api./EXTRA_HOSTS).
 *
 * Variables (Render / local):
 *   GH_PARTNER_FEED_BASE_URL — ej. https://suite-manager.onrender.com (sin barra final)
 *   GH_PARTNER_FEED_AUTH_TOKEN — mismo valor que GOOGLE_PARTNER_FEED_AUTH_TOKEN del servidor
 *
 * Uso (desde raíz del repo):
 *   node backend/scripts/smoke-google-partner-feeds-http.js
 *
 * Exit 0 si ambos GET devuelven 200 y el body parece XML; exit 1 si falla.
 *
 * Opcional — contenido no vacío (certificación / prod):
 *   GH_PARTNER_FEED_STRICT=1  exige al menos un <Property> en properties.xml y en ari.xml.
 */
const https = require('https');
const http = require('http');

function httpGet(urlStr) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.get(urlStr, { headers: { 'User-Agent': 'StayManager-partner-smoke/1' } }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                resolve({ status: res.statusCode, body });
            });
        });
        req.on('error', reject);
        req.setTimeout(120000, () => {
            req.destroy(new Error('timeout'));
        });
    });
}

function countXmlTag(body, tagName) {
    const re = new RegExp(`<${tagName}[\\s>]`, 'gi');
    const m = String(body || '').match(re);
    return m ? m.length : 0;
}

async function main() {
    const base = String(process.env.GH_PARTNER_FEED_BASE_URL || '').trim().replace(/\/$/, '');
    const token = String(process.env.GH_PARTNER_FEED_AUTH_TOKEN || '').trim();
    if (!base) {
        console.error('smoke-google-partner-feeds-http: define GH_PARTNER_FEED_BASE_URL');
        process.exit(1);
    }
    if (!token) {
        console.error('smoke-google-partner-feeds-http: define GH_PARTNER_FEED_AUTH_TOKEN');
        process.exit(1);
    }

    const strict = String(process.env.GH_PARTNER_FEED_STRICT || '').trim() === '1';

    const paths = ['/feeds/google/properties.xml', '/feeds/google/ari.xml'];
    const q = `auth=${encodeURIComponent(token)}`;

    for (const p of paths) {
        const url = `${base}${p}?${q}`;
        try {
            const { status, body } = await httpGet(url);
            const xmlOk = /<\?xml/i.test(body) || /<Transaction[\s>]/i.test(body);
            const nProp = countXmlTag(body, 'Property');
            console.log(`${p} → HTTP ${status} · XML-ish: ${xmlOk} · <Property>: ${nProp} · bytes ${body.length}`);
            if (status !== 200 || !xmlOk) {
                console.error('Body preview:', body.slice(0, 500));
                process.exit(1);
            }
            if (strict && nProp < 1) {
                console.error(`${p}: GH_PARTNER_FEED_STRICT=1 requiere al menos un <Property> (listados + datos completos en panel).`);
                process.exit(1);
            }
        } catch (e) {
            console.error(`${p} → ERROR`, e.message);
            process.exit(1);
        }
    }
    if (!strict) {
        console.log('Tip: GH_PARTNER_FEED_STRICT=1 valida que haya <Property> en ambos feeds (recomendado antes de registrar en Google).');
    }
    console.log('smoke-google-partner-feeds-http: OK');
}

main();
