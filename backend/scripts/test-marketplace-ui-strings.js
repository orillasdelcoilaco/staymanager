/**
 * Contrato: resolución de idioma y copys marketplace (ES/EN).
 */
const assert = require('assert');
const {
    resolveMarketplaceLang,
    getMarketplaceStrings,
    getMarketplaceSearchJsonUi,
    buildMarketplaceQueryBase,
    buildMarketplaceSeoUrls,
} = require('../services/marketplaceUiStrings');

function mockReq(query, acceptLanguage) {
    return {
        query: query || {},
        get: (h) => {
            const k = String(h).toLowerCase();
            if (k === 'accept-language') return acceptLanguage || '';
            if (k === 'host') return 'mp.test';
            return '';
        },
        protocol: 'https',
    };
}

assert.strictEqual(resolveMarketplaceLang(mockReq({ lang: 'en' })), 'en');
assert.strictEqual(resolveMarketplaceLang(mockReq({ lang: 'EN' })), 'en');
assert.strictEqual(resolveMarketplaceLang(mockReq({ lang: 'es' })), 'es');
assert.strictEqual(resolveMarketplaceLang(mockReq({}, 'en-US,es;q=0.9')), 'en');
assert.strictEqual(resolveMarketplaceLang(mockReq({}, 'es-CL')), 'es');
assert.strictEqual(resolveMarketplaceLang(mockReq({})), 'es');

const en = getMarketplaceStrings('en');
assert.strictEqual(en.htmlLang, 'en');
assert.ok(en.pageTitle.includes('Chile'));
assert.ok(en.labelLlegada.length > 2);

const es = getMarketplaceStrings('es');
assert.strictEqual(es.htmlLang, 'es');
assert.ok(es.sectionTodos.includes('alojamientos'));

const q = buildMarketplaceQueryBase({ busqueda: 'pucon', personas: 2, fechaIn: '2026-05-01', fechaOut: '2026-05-05' });
assert.ok(q.toString().includes('q=pucon'));
assert.ok(q.toString().includes('personas=2'));

const req = mockReq({ q: 'x' });
const seo = buildMarketplaceSeoUrls(req, {
    busqueda: 'x',
    personas: 0,
    fechaIn: null,
    fechaOut: null,
    htmlLang: 'en',
});
assert.ok(seo.canonicalUrl.includes('lang=en'));
assert.ok(seo.hreflangEnUrl.includes('lang=en'));
assert.ok(!seo.hreflangEsUrl.includes('lang='));

process.env.MARKETPLACE_DOMAIN_ES = 'marketplace-es.example.com';
process.env.MARKETPLACE_DOMAIN_EN = 'https://marketplace-en.example.com/path-ignored';
const seoCrossDomain = buildMarketplaceSeoUrls(req, {
    busqueda: 'x',
    personas: 0,
    fechaIn: null,
    fechaOut: null,
    htmlLang: 'en',
});
assert.ok(seoCrossDomain.canonicalUrl.startsWith('https://marketplace-en.example.com/'));
assert.ok(seoCrossDomain.hreflangEsUrl.startsWith('https://marketplace-es.example.com/'));
assert.ok(seoCrossDomain.hreflangEnUrl.startsWith('https://marketplace-en.example.com/'));
delete process.env.MARKETPLACE_DOMAIN_ES;
delete process.env.MARKETPLACE_DOMAIN_EN;

const uiEn = getMarketplaceSearchJsonUi('en');
assert.strictEqual(uiEn.language, 'en');
assert.ok(uiEn.fieldLabels.titulo.length > 2);

const uiEs = getMarketplaceSearchJsonUi('es');
assert.strictEqual(uiEs.fieldLabels.precioDesde, 'Precio desde');

console.log('test-marketplace-ui-strings: OK');
