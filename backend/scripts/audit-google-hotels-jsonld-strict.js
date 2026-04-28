/**
 * Auditor estricto de JSON-LD para propiedades listadas en Google Hotels.
 *
 * Uso:
 *   GH_AUDIT_EMPRESA_ID=<empresaId> node backend/scripts/audit-google-hotels-jsonld-strict.js
 */
const { auditGoogleHotelsJsonLdStrict } = require('../services/googleHotelsHealthService');

async function main() {
    const empresaId = String(process.env.GH_AUDIT_EMPRESA_ID || '').trim();
    if (!empresaId) {
        console.error('Defina GH_AUDIT_EMPRESA_ID');
        process.exit(1);
    }
    const report = await auditGoogleHotelsJsonLdStrict(empresaId);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
}

main().catch((e) => {
    console.error('GH_JSONLD_AUDIT_FATAL', e.message || e);
    process.exit(1);
});

