/**
 * Migración: crea tabla resenas y agrega columna imap_email a empresas
 * Ejecutar: node scripts/crear-tabla-resenas.js
 */
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Tabla principal de reseñas
        await client.query(`
            CREATE TABLE IF NOT EXISTS resenas (
                id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
                empresa_id   TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
                propiedad_id TEXT,
                canal        TEXT NOT NULL,
                id_externo   TEXT,
                reviewer_nombre TEXT,
                texto        TEXT,
                respuesta    TEXT,
                rating       NUMERIC(3,1),
                fecha_review TIMESTAMPTZ,
                estado       TEXT NOT NULL DEFAULT 'sin_responder',
                raw_email    JSONB DEFAULT '{}',
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(empresa_id, canal, id_externo)
            )
        `);
        console.log('✅ Tabla resenas creada');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_resenas_empresa
                ON resenas(empresa_id, estado, fecha_review DESC)
        `);
        console.log('✅ Índice resenas creado');

        // Campo para almacenar email IMAP por empresa (donde llegan los forwards de OTAs)
        await client.query(`
            ALTER TABLE empresas
            ADD COLUMN IF NOT EXISTS imap_email      TEXT,
            ADD COLUMN IF NOT EXISTS imap_last_check TIMESTAMPTZ
        `);
        console.log('✅ Columnas imap_email e imap_last_check agregadas a empresas');

        // URLs por OTA en propiedades (para Apify en fase futura)
        await client.query(`
            ALTER TABLE propiedades
            ADD COLUMN IF NOT EXISTS urls_ota JSONB DEFAULT '{}'
        `);
        console.log('✅ Columna urls_ota agregada a propiedades');

        await client.query('COMMIT');
        console.log('\n✅ Migración completada exitosamente');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(() => process.exit(1));
