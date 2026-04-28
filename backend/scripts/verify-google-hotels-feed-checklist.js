/**
 * Verificación remota de puntos §2–§3 del checklist Google Hotels (contenido).
 * No usa credenciales del repo: pasa la URL pública del tenant.
 *
 * Uso:
 *   GH_FEED_BASE_URL=https://sub.dominio.com node backend/scripts/verify-google-hotels-feed-checklist.js
 *
 * Si el tenant tiene token configurado:
 *   GH_FEED_BASE_URL=... GH_FEED_TOKEN=secreto node ...
 *
 * Sale con código 1 si algún paso falla.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

function get(urlStr) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.request(
            {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: `${u.pathname}${u.search}`,
                method: 'GET',
                headers: { Accept: 'application/json, application/xml, text/xml, */*' },
            },
            (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    resolve({
                        status: res.statusCode || 0,
                        ctype: String(res.headers['content-type'] || ''),
                        body: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            }
        );
        req.on('error', reject);
        req.end();
    });
}

function assertXmlShape(xml) {
    const t = String(xml || '').trim();
    if (!t.includes('<?xml')) throw new Error('Falta declaración XML');
    if (!/<Transaction[\s>]/i.test(t)) throw new Error('Falta nodo Transaction');
    if (!/<\/Transaction>/i.test(t)) throw new Error('Falta cierre Transaction');
    if (!/<Result[\s>]/i.test(t)) throw new Error('Falta nodo Result');
    if (!/<\/Result>/i.test(t)) throw new Error('Falta cierre Result');
}

async function main() {
    const base = String(process.env.GH_FEED_BASE_URL || '').replace(/\/+$/, '');
    const token = String(process.env.GH_FEED_TOKEN || '').trim();

    if (!base) {
        console.error('Defina GH_FEED_BASE_URL (origen del sitio público, sin barra final).');
        process.exit(1);
    }

    const results = [];
    const ok = (m) => { results.push(`OK  ${m}`); console.log(`OK  ${m}`); };
    const fail = (m) => { results.push(`FAIL ${m}`); console.error(`FAIL ${m}`); };

    try {
        const helpUrl = `${base}/widget-reserva-ayuda.json`;
        const h = await get(helpUrl);
        if (h.status !== 200) {
            fail(`widget-reserva-ayuda.json → HTTP ${h.status}`);
            process.exit(1);
        }
        let j;
        try {
            j = JSON.parse(h.body);
        } catch {
            fail('widget-reserva-ayuda.json no es JSON válido');
            process.exit(1);
        }
        if (!j.googleHotelsContentFeed?.endpoint) {
            fail('JSON sin bloque googleHotelsContentFeed.endpoint');
            process.exit(1);
        }
        ok('widget-reserva-ayuda.json incluye googleHotelsContentFeed');

        const feedPath = '/feed-google-hotels-content.xml';
        const feedUrl = `${base}${feedPath}`;

        const noToken = await get(feedUrl);
        if (token) {
            if (noToken.status !== 401) {
                fail(`Con token en env: esperaba 401 sin ?token=, obtuve ${noToken.status}`);
            } else {
                ok('Sin ?token= → 401 (token requerido en servidor)');
            }
            const bad = await get(`${feedUrl}?token=__invalid__`);
            if (bad.status !== 401) {
                fail(`Token inválido: esperaba 401, obtuve ${bad.status}`);
            } else {
                ok('Token inválido → 401');
            }
            const good = await get(`${feedUrl}?token=${encodeURIComponent(token)}`);
            if (good.status !== 200) {
                fail(`Token válido: esperaba 200, obtuve ${good.status}`);
                process.exit(1);
            }
            if (!/xml/i.test(good.ctype)) {
                fail(`Content-Type no parece XML: ${good.ctype}`);
            } else {
                ok(`Content-Type XML (${good.ctype})`);
            }
            try {
                assertXmlShape(good.body);
            } catch (e) {
                fail(`XML: ${e.message}`);
                process.exit(1);
            }
            ok('XML: Transaction / Result bien formados');
        } else {
            if (noToken.status !== 200) {
                fail(`Sin GH_FEED_TOKEN: esperaba 200 en feed público, obtuve ${noToken.status} (si el tenant exige token, defina GH_FEED_TOKEN)`);
                process.exit(1);
            }
            if (!/xml/i.test(noToken.ctype)) {
                fail(`Content-Type no parece XML: ${noToken.ctype}`);
            } else {
                ok(`Content-Type XML (${noToken.ctype})`);
            }
            try {
                assertXmlShape(noToken.body);
            } catch (e) {
                fail(`XML: ${e.message}`);
                process.exit(1);
            }
            ok('XML: Transaction / Result bien formados');
        }

        console.log('\nResumen: checklist §2–§3 (acceso + forma XML) verificado contra', base);
        process.exit(0);
    } catch (e) {
        console.error('Error de red o URL:', e.message || e);
        process.exit(1);
    }
}

main();
