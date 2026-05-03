/**
 * Contrato mínimo: módulo partner carga y, con PostgreSQL + token o bypass dev, genera XML bien formado.
 * Uso (desde raíz del repo o backend/):
 *   set ALLOW_PARTNER_FEED_WITHOUT_AUTH=1 && node backend/scripts/test-google-partner-feeds-smoke.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('../db/postgres');
const {
    generateGlobalPropertyListXml,
    generateGlobalAriXml,
    getPartnerCatalogItems,
} = require('../services/googleHotelsPartner/googleHotelsPartnerFeeds');

async function main() {
    if (!pool) {
        console.log('test-google-partner-feeds-smoke: SKIP (no DATABASE_URL)');
        process.exit(0);
    }
    const { XMLParser } = require('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false });

    const p = await generateGlobalPropertyListXml(null);
    parser.parse(p.xml);
    const a = await generateGlobalAriXml(null);
    parser.parse(a.xml);
    const c = await getPartnerCatalogItems();
    if (c.postgresRequired) {
        throw new Error('getPartnerCatalogItems should not require postgres when pool exists');
    }
    console.log('test-google-partner-feeds-smoke: OK (property + ari + catalog, skipped property:', p.skipped.length, 'ari empresa:', a.skipped.length, 'catalog items:', c.items.length, ')');
}

main().catch((e) => {
    console.error('test-google-partner-feeds-smoke: FAIL', e.message);
    process.exit(1);
});
