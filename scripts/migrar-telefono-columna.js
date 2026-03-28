// scripts/migrar-telefono-columna.js
// Promueve telefonoNormalizado de metadata JSONB a columna real con índice único.
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Agregar columna
        await client.query(`
            ALTER TABLE clientes
                ADD COLUMN IF NOT EXISTS telefono_normalizado TEXT
        `);
        console.log('✅ Columna telefono_normalizado agregada');

        // 2. Backfill desde metadata JSONB
        const { rowCount } = await client.query(`
            UPDATE clientes
            SET telefono_normalizado = metadata->>'telefonoNormalizado'
            WHERE metadata->>'telefonoNormalizado' IS NOT NULL
              AND telefono_normalizado IS NULL
        `);
        console.log(`✅ Backfill: ${rowCount} filas actualizadas`);

        // 3. Índice único parcial (solo donde no es null — permite múltiples sin teléfono)
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_telefono_uq
                ON clientes (empresa_id, telefono_normalizado)
                WHERE telefono_normalizado IS NOT NULL
        `);
        console.log('✅ Índice único (empresa_id, telefono_normalizado) creado');

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
