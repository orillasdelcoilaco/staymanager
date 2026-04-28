/**
 * Ejecuta un archivo .sql contra PostgreSQL (usa DATABASE_URL y dotenv si existe).
 * Uso: node backend/scripts/apply-sql-migration.js db/migrations/crm-campanas-interacciones.sql
 */
const fs = require('fs');
const path = require('path');

const rel = process.argv[2];
if (!rel) {
    console.error('Uso: node backend/scripts/apply-sql-migration.js <ruta-relativa-desde-backend/>');
    process.exit(1);
}

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {}

const sqlPath = path.isAbsolute(rel) ? rel : path.join(__dirname, '..', rel);
if (!fs.existsSync(sqlPath)) {
    console.error('No existe el archivo:', sqlPath);
    process.exit(1);
}

const pool = require('../db/postgres');
if (!pool) {
    console.error('PostgreSQL no activo (IS_POSTGRES / pool).');
    process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

pool.query(sql)
    .then(() => {
        console.log('OK:', sqlPath);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error:', err.message);
        process.exit(1);
    })
    .finally(() => pool.end());
