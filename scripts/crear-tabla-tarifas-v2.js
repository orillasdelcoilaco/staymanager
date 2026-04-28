// scripts/crear-tabla-tarifas-v2.js
// Elimina el esquema antiguo de tarifas (monolítico con reglas JSONB)
// y crea el nuevo modelo: temporadas + tarifas separadas.
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Eliminar tabla antigua
        await client.query('DROP TABLE IF EXISTS tarifas CASCADE');
        console.log('✅ Tabla tarifas (antigua) eliminada');

        // 2. Crear tabla temporadas
        await client.query(`
            CREATE TABLE temporadas (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                empresa_id   TEXT NOT NULL,
                nombre       TEXT NOT NULL,
                fecha_inicio DATE NOT NULL,
                fecha_termino DATE NOT NULL,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        await client.query('CREATE INDEX idx_temporadas_empresa ON temporadas (empresa_id)');
        console.log('✅ Tabla temporadas creada');

        // 3. Crear tabla tarifas (nueva: precio por propiedad x temporada)
        await client.query(`
            CREATE TABLE tarifas (
                id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                empresa_id     TEXT NOT NULL,
                temporada_id   UUID NOT NULL REFERENCES temporadas(id) ON DELETE CASCADE,
                propiedad_id   TEXT NOT NULL REFERENCES propiedades(id),
                precio_base    NUMERIC(12,2) NOT NULL,
                valor_dolar_dia NUMERIC(10,4),
                precios_canales JSONB DEFAULT '{}',
                created_at     TIMESTAMPTZ DEFAULT NOW(),
                updated_at     TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(temporada_id, propiedad_id)
            )
        `);
        await client.query('CREATE INDEX idx_tarifas_empresa    ON tarifas (empresa_id)');
        await client.query('CREATE INDEX idx_tarifas_temporada  ON tarifas (temporada_id)');
        await client.query('CREATE INDEX idx_tarifas_propiedad  ON tarifas (propiedad_id)');
        console.log('✅ Tabla tarifas (nueva) creada');

        await client.query('COMMIT');
        console.log('\n✅ Migración completada.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
