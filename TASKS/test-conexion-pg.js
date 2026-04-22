/**
 * Test de conexión PostgreSQL
 *
 * Este script verifica por qué el sistema dice "modo Firestore activo"
 * cuando DATABASE_URL está definida.
 */

require('dotenv').config();

console.log('=== TEST CONEXIÓN POSTGRESQL ===\n');

// 1. Verificar DATABASE_URL
console.log('1. Verificando DATABASE_URL...');
console.log(`   Definida: ${!!process.env.DATABASE_URL}`);
if (process.env.DATABASE_URL) {
    // Ocultar contraseña para seguridad
    const masked = process.env.DATABASE_URL.replace(/:[^:@]*@/, ':****@');
    console.log(`   Valor: ${masked}`);
    console.log(`   Longitud: ${process.env.DATABASE_URL.length} caracteres`);
} else {
    console.log('❌ DATABASE_URL no definida');
    process.exit(1);
}

// 2. Intentar conexión
console.log('\n2. Intentando conexión...');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configurar manejadores de eventos
pool.on('error', (err) => {
    console.error('   ❌ Error en pool:', err.message);
});

pool.on('connect', () => {
    console.log('   ✅ Cliente conectado al pool');
});

pool.on('acquire', () => {
    console.log('   ✅ Cliente adquirido del pool');
});

pool.on('remove', () => {
    console.log('   ℹ️  Cliente removido del pool');
});

// 3. Probar conexión real
async function testConexion() {
    let client;
    try {
        console.log('\n3. Probando query SELECT NOW()...');
        client = await pool.connect();
        console.log('   ✅ Cliente conectado exitosamente');

        const result = await client.query('SELECT NOW() as hora, version() as version');
        console.log('   ✅ Query ejecutada exitosamente');
        console.log(`   - Hora servidor: ${result.rows[0].hora}`);
        console.log(`   - PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);

        // 4. Verificar tabla galeria
        console.log('\n4. Verificando tabla galeria...');
        try {
            const galeriaCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'galeria'
                ) as existe
            `);

            if (galeriaCheck.rows[0].existe) {
                console.log('   ✅ Tabla "galeria" EXISTE en PostgreSQL');

                // Contar filas
                const countResult = await client.query('SELECT COUNT(*) as total FROM galeria');
                console.log(`   - Total fotos en galeria: ${countResult.rows[0].total}`);

                // Verificar estructura
                const structure = await client.query(`
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = 'galeria'
                    ORDER BY ordinal_position
                    LIMIT 5
                `);

                console.log(`   - Columnas (primeras 5):`);
                structure.rows.forEach(r => {
                    console.log(`     * ${r.column_name} (${r.data_type})`);
                });
            } else {
                console.log('   ❌ Tabla "galeria" NO EXISTE en PostgreSQL');
            }

        } catch (err) {
            console.log(`   ⚠️  Error verificando tabla: ${err.message}`);
        }

    } catch (err) {
        console.error(`   ❌ Error de conexión: ${err.message}`);
        console.error(`   Detalle: ${err.detail || 'N/A'}`);
        console.error(`   Código: ${err.code || 'N/A'}`);

        // Posibles problemas comunes
        if (err.code === 'ECONNREFUSED') {
            console.log('\n   🔍 Posible problema: Conexión rechazada');
            console.log('   - Verificar que Supabase esté activo');
            console.log('   - Verificar firewall/red');
            console.log('   - Verificar credenciales');
        } else if (err.code === '28P01') {
            console.log('\n   🔍 Posible problema: Autenticación fallida');
            console.log('   - Verificar usuario/contraseña en DATABASE_URL');
            console.log('   - Verificar que la contraseña no tenga caracteres especiales que necesiten encoding');
        } else if (err.message.includes('self signed certificate')) {
            console.log('\n   🔍 Posible problema: Certificado SSL');
            console.log('   - Probar con ssl: { rejectUnauthorized: true }');
        }

    } finally {
        if (client) {
            client.release();
            console.log('\n   ✅ Cliente liberado');
        }

        await pool.end();
        console.log('   ✅ Pool cerrado');
    }
}

// Ejecutar test
testConexion().catch(err => {
    console.error('Error en test:', err);
}).finally(() => {
    console.log('\n=== CONCLUSIÓN ===');
    console.log('Si la conexión falla, el sistema usará modo Firestore.');
    console.log('Si la conexión funciona, revisar por qué postgres.js dice "modo Firestore".');
});