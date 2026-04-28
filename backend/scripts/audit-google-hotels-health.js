/**
 * Auditor diario (cron/manual) de salud Google Hotels por empresa.
 * - Evalúa inventario listado, feeds y JSON-LD strict.
 * - Útil para operación proactiva (semaforo green/yellow/red).
 *
 * Uso:
 *   node backend/scripts/audit-google-hotels-health.js
 *
 * Opcionales:
 *   GH_AUDIT_FAIL_ON_RED=1   -> exit code 1 si alguna empresa queda en rojo
 *   GH_AUDIT_EMPRESA_ID=...  -> auditar solo una empresa
 */
const pool = require('../db/postgres');
const { evaluateGoogleHotelsHealth } = require('../services/googleHotelsHealthService');

async function getEmpresasObjetivo() {
    const only = String(process.env.GH_AUDIT_EMPRESA_ID || '').trim();
    if (only) return [only];
    const { rows } = await pool.query('SELECT id FROM empresas ORDER BY id ASC');
    return rows.map((r) => String(r.id));
}

async function main() {
    if (!pool) {
        console.error('POSTGRES_REQUIRED');
        process.exit(1);
    }
    const empresaIds = await getEmpresasObjetivo();
    const reports = [];
    for (const empresaId of empresaIds) {
        try {
            const r = await evaluateGoogleHotelsHealth(empresaId);
            reports.push(r);
            console.log(`[GH-AUDIT] ${empresaId} -> ${r.semaforo} | listadas=${r.inventario?.listadas || 0} | jsonld_ok=${r.jsonLdStrict?.ok}`);
        } catch (e) {
            reports.push({ empresaId, semaforo: 'red', ok: false, error: e.message || 'UNKNOWN' });
            console.error(`[GH-AUDIT] ${empresaId} -> red | error=${e.message}`);
        }
    }
    const reds = reports.filter((r) => r.semaforo === 'red').length;
    const yellows = reports.filter((r) => r.semaforo === 'yellow').length;
    const greens = reports.filter((r) => r.semaforo === 'green').length;
    console.log(`\nResumen GH audit: green=${greens} yellow=${yellows} red=${reds}`);
    const failOnRed = String(process.env.GH_AUDIT_FAIL_ON_RED || '').trim() === '1';
    if (failOnRed && reds > 0) process.exit(1);
}

main().catch((e) => {
    console.error('GH_AUDIT_FATAL', e.message || e);
    process.exit(1);
});

