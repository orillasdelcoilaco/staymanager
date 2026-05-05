// scripts/legacy/run-espera-disponibilidad-migration.js
// Ejecuta la migración espera-disponibilidad.sql contra la BD configurada en DATABASE_URL.
const path = require('path');
require(path.join(__dirname, '../../backend/node_modules/dotenv')).config({
    path: path.join(__dirname, '../../backend/.env'),
});
const { Pool } = require(path.join(__dirname, '../../backend/node_modules/pg'));
const fs = require('fs');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida. Configura backend/.env antes de ejecutar.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function run() {
    const sqlPath = path.join(__dirname, '../../backend/db/migrations/espera-disponibilidad.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log('⏳ Ejecutando migración espera-disponibilidad.sql ...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Migración completada.');

        // Verificar que las tablas existen
        const { rows: tables } = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('espera_disponibilidad_estados', 'espera_disponibilidad')
            ORDER BY table_name
        `);
        if (tables.length === 2) {
            console.log('✅ Tablas verificadas:', tables.map(r => r.table_name).join(', '));
        } else {
            console.error('⚠️  Solo se encontraron', tables.length, 'tabla(s):', tables.map(r => r.table_name).join(', '));
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
