#!/usr/bin/env node
/**
 * Pruebas HTTP contra el feed público de contenido Google Hotels.
 * Complementa `test-google-hotels-content-feed-request.js` (lógica pura) con requests reales.
 *
 * Uso (desde la raíz del repositorio):
 *   node backend/scripts/test-feed-google-hotels-content-http.js "<baseDelSitioTenant>"
 *   node backend/scripts/test-feed-google-hotels-content-http.js "<baseDelSitioTenant>" "<tokenConfigurado>"
 *
 * baseDelSitioTenant: origen del SSR del tenant, con query si hace falta (p. ej. force_host en local).
 *   Ej.: http://127.0.0.1:3001?force_host=miempresa.onrender.com
 *   Ej.: https://miempresa.suitemanagers.com
 *
 * Sin segundo argumento: espera 200 sin ?token= (empresa sin token de contenido).
 *   Si responde 401, asume token activo e indica re-ejecutar con el token.
 *
 * Con segundo argumento: asume token configurado — valida 401 sin token, 401 token incorrecto, 200 token correcto.
 */
const assert = require('assert');
const fetch = require('node-fetch');

function buildUrl(baseStr, path) {
    const base = new URL(baseStr);
    const u = new URL(path, base.origin);
    u.search = base.search;
    return u.href;
}

async function get(url) {
    const res = await fetch(url, { redirect: 'manual' });
    const text = await res.text();
    return { res, text };
}

function assertXmlFeedOk(text, label) {
    const head = String(text || '').slice(0, 400);
    const ok = /<\?xml/i.test(text) && (/<Transaction/i.test(text) || /<Property/i.test(text) || /<Result/i.test(text));
    assert.ok(ok, `${label}: XML de feed inesperado. Inicio: ${head.replace(/\s+/g, ' ')}`);
}

async function main() {
    const baseArg = process.argv[2];
    const tokenArg = process.argv[3];

    if (!baseArg) {
        console.error(`
Uso (desde la raíz del repo):
  node backend/scripts/test-feed-google-hotels-content-http.js "<baseDelSitioTenant>"
  node backend/scripts/test-feed-google-hotels-content-http.js "<baseDelSitioTenant>" "<token>"

Ejemplo local:
  node backend/scripts/test-feed-google-hotels-content-http.js "http://127.0.0.1:3001?force_host=miempresa.onrender.com"
`);
        process.exit(1);
    }

    const feedUrl = buildUrl(baseArg, '/feed-google-hotels-content.xml');
    const helpUrl = buildUrl(baseArg, '/widget-reserva-ayuda.json');

    const { res: hRes, text: hText } = await get(helpUrl);
    assert.strictEqual(hRes.status, 200, `widget-reserva-ayuda.json debe ser 200, fue ${hRes.status}`);
    let helpJson;
    try {
        helpJson = JSON.parse(hText);
    } catch (e) {
        assert.fail(`Ayuda JSON inválida: ${e.message}`);
    }
    assert.strictEqual(helpJson.ok, true);
    assert.ok(helpJson.googleHotelsContentFeed && helpJson.googleHotelsContentFeed.endpoint,
        'Debe existir bloque googleHotelsContentFeed.endpoint');

    if (!tokenArg) {
        const { res, text } = await get(feedUrl);
        if (res.status === 401) {
            console.log('GET feed sin token → 401 (empresa con token de contenido). Re-ejecuta pasando el token como segundo argumento.');
            console.log('widget-reserva-ayuda.json: OK (bloque googleHotelsContentFeed presente)');
            process.exit(0);
        }
        assert.strictEqual(res.status, 200, `Sin token configurado en empresa: esperaba 200, fue ${res.status}`);
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        assert.ok(ct.includes('xml'), `Content-Type debe ser XML, fue: ${ct}`);
        assertXmlFeedOk(text, 'Feed público');
        console.log('test-feed-google-hotels-content-http: OK (feed 200 sin token + ayuda JSON)');
        return;
    }

    const token = String(tokenArg).trim();
    assert.ok(token.length > 0, 'Token vacío');

    const { res: r0, text: t0 } = await get(feedUrl);
    assert.strictEqual(r0.status, 401, `Sin ?token=: esperaba 401, fue ${r0.status} — ${t0.slice(0, 80)}`);

    const badUrl = `${feedUrl}${feedUrl.includes('?') ? '&' : '?'}token=___invalid___`;
    const { res: r1 } = await get(badUrl);
    assert.strictEqual(r1.status, 401, `Token incorrecto: esperaba 401, fue ${r1.status}`);

    const goodUrl = `${feedUrl}${feedUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    const { res: r2, text: t2 } = await get(goodUrl);
    assert.strictEqual(r2.status, 200, `Token válido: esperaba 200, fue ${r2.status}`);
    const ct2 = (r2.headers.get('content-type') || '').toLowerCase();
    assert.ok(ct2.includes('xml'), `Content-Type debe ser XML, fue: ${ct2}`);
    assertXmlFeedOk(t2, 'Feed con token');

    console.log('test-feed-google-hotels-content-http: OK (401/401/200 + ayuda JSON)');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
