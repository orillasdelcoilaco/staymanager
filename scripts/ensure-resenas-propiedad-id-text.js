// Alinea resenas.propiedad_id con reservas/propiedades (id slug, p. ej. "cabana-7").
// Idempotente: solo convierte UUID → TEXT si la columna sigue siendo uuid.
// Ejecutar desde la raíz: node scripts/ensure-resenas-propiedad-id-text.js

require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function run() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            `SELECT data_type, udt_name FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'resenas'
               AND column_name = 'propiedad_id'`
        );
        const col = rows[0];
        if (!col) {
            console.log('ℹ️  Tabla resenas o columna propiedad_id no existe; omitiendo.');
            return;
        }
        const isUuid = String(col.udt_name || '').toLowerCase() === 'uuid'
            || String(col.data_type || '').toLowerCase() === 'uuid';
        if (!isUuid) {
            console.log('✅ resenas.propiedad_id ya es tipo compatible con texto/slug.');
            return;
        }
        await client.query(`
            ALTER TABLE resenas
            ALTER COLUMN propiedad_id TYPE TEXT USING propiedad_id::text
        `);
        console.log('✅ resenas.propiedad_id pasado a TEXT (compatible con slugs tipo cabana-7).');
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
