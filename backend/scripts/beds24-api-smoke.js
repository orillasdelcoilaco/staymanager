/**
 * Prueba mínima Beds24 API V2 (token + GET diagnóstico + GET propiedades).
 *
 * Requiere en backend/.env (no commitear):
 *   BEDS24_REFRESH_TOKEN — recomendado para integración con escritura, o
 *   BEDS24_LONG_LIFE_TOKEN — solo lectura, o
 *   BEDS24_ACCESS_TOKEN — token corto (dev)
 *
 * Opcional: BEDS24_API_BASE (default https://beds24.com/api/v2)
 *
 * Uso desde la raíz del repo:
 *   node backend/scripts/beds24-api-smoke.js
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getBeds24ApiBase, beds24Request } = require('../services/beds24/beds24Client');

async function main() {
    const base = getBeds24ApiBase();
    // eslint-disable-next-line no-console
    console.log('[beds24-smoke] base', base);

    let r = await beds24Request('GET', '/authentication/details', {});
    // eslint-disable-next-line no-console
    console.log('[beds24-smoke] GET /authentication/details', r.status, JSON.stringify(r.json).slice(0, 600));

    r = await beds24Request('GET', '/properties', {});
    // eslint-disable-next-line no-console
    console.log('[beds24-smoke] GET /properties', r.status, JSON.stringify(r.json).slice(0, 1200));

    if (!r.ok) {
        process.exit(1);
    }
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[beds24-smoke] error', e.message || e);
    process.exit(1);
});
