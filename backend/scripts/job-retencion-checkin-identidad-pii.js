/**
 * Job: elimina PII de identidad check-in web en reservas según política por empresa.
 * Requiere PostgreSQL y `DATABASE_URL` / `backend/.env`.
 *
 * Uso:
 *   node backend/scripts/job-retencion-checkin-identidad-pii.js
 *   node backend/scripts/job-retencion-checkin-identidad-pii.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('../db/postgres');
const { ejecutarRetencionCheckinIdentidadPii } = require('../services/reservaWebCheckinIdentidadRetencionService');

(async () => {
    const dryRun = process.argv.includes('--dry-run');
    const r = await ejecutarRetencionCheckinIdentidadPii(pool, { dryRun });
    console.log(JSON.stringify(r, null, 2));
    await pool.end();
    process.exit(0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
