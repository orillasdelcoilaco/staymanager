/**
 * backend/db/postgres.js
 *
 * Pool de conexiones PostgreSQL (Supabase + PgBouncer).
 *
 * Modo dual:
 *  - Si DATABASE_URL está definida → conecta a PostgreSQL vía PgBouncer
 *  - Si no está definida → exporta null (el sistema sigue en modo Firestore)
 *
 * Uso en servicios:
 *   const pool = require('../db/postgres');
 *   if (pool) {
 *       const { rows } = await pool.query('SELECT ...', [params]);
 *   }
 */

const { Pool } = require('pg');
const dns = require('dns');

// Forzar IPv4 en resolución DNS — entornos cloud como Render resuelven
// hostnames de Supabase a IPv6 por defecto, pero no tienen conectividad IPv6.
dns.setDefaultResultOrder('ipv4first');

if (!process.env.DATABASE_URL) {
    console.log('[PostgreSQL] DATABASE_URL no definida — modo Firestore activo.');
    module.exports = null;
} else {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // PgBouncer en modo transaction no soporta prepared statements
        // port 6543 = PgBouncer (Supabase), port 5432 = PostgreSQL directo
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('error', (err) => {
        console.error('[PostgreSQL] Error inesperado en cliente idle:', err.message);
    });

    pool.connect()
        .then(client => {
            client.query('SELECT NOW()').then(res => {
                console.log(`[PostgreSQL] Conexión establecida. Servidor: ${res.rows[0].now}`);
                client.release();
            });
        })
        .catch(err => {
            console.error('[PostgreSQL] Error al conectar:', err.message);
        });

    /**
     * Helper para ejecutar queries con parámetros nombrados.
     * Envuelve pool.query y hace release automático.
     *
     * @param {string} text  — Query SQL con $1, $2, etc.
     * @param {Array}  params — Parámetros posicionales
     * @returns {Promise<{rows: Array, rowCount: number}>}
     */
    pool.q = (text, params = []) => pool.query(text, params);

    module.exports = pool;
}
