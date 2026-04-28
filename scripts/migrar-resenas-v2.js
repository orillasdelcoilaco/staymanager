// scripts/migrar-resenas-v2.js
// Fusiona comentarios → resenas y amplía el schema de resenas
// Ejecutar: node scripts/migrar-resenas-v2.js
require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Cambiar propiedad_id de UUID a TEXT (propiedades.id es TEXT slug)
        await client.query(`
            ALTER TABLE resenas ALTER COLUMN propiedad_id TYPE TEXT USING propiedad_id::text
        `);
        console.log('✅ propiedad_id cambiado a TEXT');

        // 2. Nuevas columnas
        const cols = [
            `ADD COLUMN IF NOT EXISTS origen       TEXT NOT NULL DEFAULT 'token'`,
            `ADD COLUMN IF NOT EXISTS canal_id     TEXT`,
            `ADD COLUMN IF NOT EXISTS cliente_nombre TEXT`,
            `ADD COLUMN IF NOT EXISTS foto1_url    TEXT`,
            `ADD COLUMN IF NOT EXISTS foto2_url    TEXT`,
            `ADD COLUMN IF NOT EXISTS fecha_resena DATE`,
        ];
        for (const col of cols) {
            await client.query(`ALTER TABLE resenas ${col}`);
        }
        console.log('✅ Columnas agregadas a resenas');

        // 3. Migrar datos de comentarios → resenas (si existe la tabla)
        const { rows: [{ exists }] } = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables WHERE table_name = 'comentarios'
            ) AS exists
        `);

        if (!exists) {
            console.log('ℹ️  Tabla comentarios no encontrada, saltando migración de datos');
        } else {
            const { rows: comentarios } = await client.query(`SELECT * FROM comentarios`);
            let migrated = 0;
            for (const c of comentarios) {
                const punt = c.nota ? Math.min(5, Math.max(1, Math.round(parseFloat(c.nota)))) : null;
                const fecha = c.fecha instanceof Date ? c.fecha : (c.fecha ? new Date(c.fecha) : null);
                await client.query(`
                    INSERT INTO resenas (
                        empresa_id, reserva_id, propiedad_id, nombre_huesped, cliente_nombre,
                        texto_positivo, punt_general, estado, origen,
                        canal_id, foto1_url, foto2_url, fecha_resena, created_at
                    ) VALUES ($1,$2,NULL,$3,$4,$5,$6,'publicada','manual',$7,$8,$9,$10,$11)
                    ON CONFLICT DO NOTHING
                `, [
                    c.empresa_id, c.reserva_id,
                    c.cliente_nombre, c.cliente_nombre,
                    c.comentario, punt,
                    c.canal_id, c.foto1_url, c.foto2_url,
                    fecha, c.created_at
                ]);
                migrated++;
            }
            console.log(`✅ ${migrated} comentarios migrados a resenas (origen='manual')`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Migración completada exitosamente.');
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
