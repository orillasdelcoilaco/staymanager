// scripts/crear-tabla-resenas.js
// Ejecutar desde la raíz del proyecto: node scripts/crear-tabla-resenas.js
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`DROP TABLE IF EXISTS resenas`);
        console.log('🗑️  Tabla resenas anterior eliminada');

        await client.query(`
            CREATE TABLE resenas (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                empresa_id      TEXT NOT NULL,
                propiedad_id    UUID,
                reserva_id      TEXT,
                token           UUID NOT NULL DEFAULT gen_random_uuid(),
                token_usado_at  TIMESTAMPTZ,
                nombre_huesped  TEXT,
                email_huesped   TEXT,
                punt_general    SMALLINT CHECK (punt_general BETWEEN 1 AND 5),
                punt_limpieza   SMALLINT CHECK (punt_limpieza BETWEEN 1 AND 5),
                punt_ubicacion  SMALLINT CHECK (punt_ubicacion BETWEEN 1 AND 5),
                punt_llegada    SMALLINT CHECK (punt_llegada BETWEEN 1 AND 5),
                punt_comunicacion SMALLINT CHECK (punt_comunicacion BETWEEN 1 AND 5),
                punt_equipamiento SMALLINT CHECK (punt_equipamiento BETWEEN 1 AND 5),
                punt_valor      SMALLINT CHECK (punt_valor BETWEEN 1 AND 5),
                texto_positivo  TEXT,
                texto_negativo  TEXT,
                respuesta_texto TEXT,
                respuesta_fecha TIMESTAMPTZ,
                respuesta_autor TEXT,
                estado          TEXT NOT NULL DEFAULT 'pendiente'
                                    CHECK (estado IN ('pendiente','publicada','oculta')),
                visibilidad     TEXT NOT NULL DEFAULT 'publica'
                                    CHECK (visibilidad IN ('publica','interna')),
                google_click_at TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        console.log('✅ Tabla resenas creada (o ya existía)');

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS resenas_token_idx ON resenas (token)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS resenas_empresa_idx ON resenas (empresa_id, created_at DESC)
        `);
        console.log('✅ Índices creados');

        await client.query(`
            ALTER TABLE empresas
                ADD COLUMN IF NOT EXISTS google_maps_url TEXT
        `);
        console.log('✅ Columna google_maps_url agregada a empresas');

        await client.query('COMMIT');
        console.log('\n✅ Migración completada exitosamente.');
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
