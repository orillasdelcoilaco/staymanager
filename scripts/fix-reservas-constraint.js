// scripts/fix-reservas-constraint.js
// Cambia el unique constraint de reservas de (empresa_id, id_reserva_canal)
// a (empresa_id, id_reserva_canal, propiedad_id) para soportar reservas
// que abarcan múltiples cabañas con el mismo código de canal.

require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Verificando constraint actual...');
        const { rows } = await client.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'reservas'
              AND constraint_type = 'UNIQUE'
              AND constraint_name LIKE '%id_reserva_canal%'
        `);
        console.log('Constraints encontrados:', rows.map(r => r.constraint_name));

        for (const row of rows) {
            console.log(`Eliminando: ${row.constraint_name}`);
            await client.query(`ALTER TABLE reservas DROP CONSTRAINT "${row.constraint_name}"`);
        }

        console.log('Creando nuevo constraint (empresa_id, id_reserva_canal, propiedad_id)...');
        await client.query(`
            ALTER TABLE reservas
            ADD CONSTRAINT reservas_empresa_id_id_reserva_canal_propiedad_key
            UNIQUE (empresa_id, id_reserva_canal, propiedad_id)
        `);

        console.log('✅ Constraint actualizado correctamente.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
