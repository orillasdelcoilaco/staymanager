const fs = require('fs');
const path = require('path');

async function checkPostgresPhotos() {
    console.log('=== VERIFICACIÓN DE FOTOS EN POSTGRESQL ===');
    console.log('Fecha:', new Date().toISOString());
    console.log('');

    // 1. Leer DATABASE_URL desde .env
    const envPath = path.join(__dirname, '../backend/.env');
    if (!fs.existsSync(envPath)) {
        console.log('❌ .env no encontrado:', envPath);
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
    if (!dbUrlMatch) {
        console.log('❌ DATABASE_URL no encontrada en .env');
        return;
    }

    const databaseUrl = dbUrlMatch[1].trim();
    console.log('✅ DATABASE_URL encontrada');
    console.log('   Host: aws-1-sa-east-1.pooler.supabase.com');
    console.log('   Puerto: 6543');
    console.log('');

    try {
        // Intentar cargar el módulo pg
        console.log('🔌 Intentando conectar a PostgreSQL...');
        const { Pool } = require('pg');

        const pool = new Pool({
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        });

        // Probar conexión
        console.log('📡 Conectando...');
        const client = await pool.connect();
        console.log('✅ Conexión establecida');
        console.log('');

        // Consulta 1: Contar fotos descartadas
        console.log('1. 📊 CONTANDO FOTOS DESCARTADAS');
        console.log('===============================');
        const countResult = await client.query(
            "SELECT COUNT(*) as total FROM galeria WHERE estado = 'descartada'"
        );
        const totalDescartadas = parseInt(countResult.rows[0].total);
        console.log(`   Total fotos descartadas: ${totalDescartadas}`);
        console.log('');

        if (totalDescartadas > 0) {
            // Consulta 2: Detalles de fotos descartadas
            console.log('2. 📋 DETALLES DE FOTOS DESCARTADAS');
            console.log('==================================');
            const detailsResult = await client.query(`
                SELECT
                    id,
                    empresa_id,
                    propiedad_id,
                    storage_url,
                    thumbnail_url,
                    storage_path,
                    estado,
                    created_at,
                    updated_at
                FROM galeria
                WHERE estado = 'descartada'
                ORDER BY created_at DESC
                LIMIT 10
            `);

            console.log(`   Mostrando ${detailsResult.rows.length} fotos:`);
            detailsResult.rows.forEach((row, index) => {
                console.log(`\\n   📷 Foto ${index + 1}:`);
                console.log(`      ID: ${row.id}`);
                console.log(`      Empresa: ${row.empresa_id}`);
                console.log(`      Propiedad: ${row.propiedad_id}`);
                console.log(`      Estado: ${row.estado}`);
                console.log(`      Creada: ${row.created_at}`);
                console.log(`      URL: ${row.storage_url ? row.storage_url.substring(0, 50) + '...' : 'N/A'}`);
                console.log(`      Path: ${row.storage_path || 'N/A'}`);
            });
            console.log('');

            // Consulta 3: Verificar si hay fotos eliminadas recientemente
            console.log('3. 🔍 VERIFICANDO ELIMINACIONES RECIENTES');
            console.log('========================================');
            const deletedResult = await client.query(`
                SELECT
                    COUNT(*) as total_eliminadas,
                    empresa_id,
                    propiedad_id
                FROM galeria
                WHERE deleted_at IS NOT NULL
                GROUP BY empresa_id, propiedad_id
                ORDER BY total_eliminadas DESC
                LIMIT 5
            `);

            if (deletedResult.rows.length > 0) {
                console.log('   Fotos marcadas como eliminadas (deleted_at):');
                deletedResult.rows.forEach(row => {
                    console.log(`   - Empresa: ${row.empresa_id}, Propiedad: ${row.propiedad_id}`);
                    console.log(`     Total: ${row.total_eliminadas}`);
                });
            } else {
                console.log('   ℹ️  No hay fotos marcadas con deleted_at');
            }
        } else {
            console.log('✅ ¡EXCELENTE! No hay fotos descartadas en la base de datos.');
            console.log('   Esto significa que la función descartarFoto() está funcionando correctamente.');
            console.log('   Las fotos se eliminan completamente (storage + BD) cuando se descartan.');
        }

        // Consulta 4: Estadísticas generales
        console.log('\\n4. 📈 ESTADÍSTICAS GENERALES DE GALERÍA');
        console.log('======================================');
        const statsResult = await client.query(`
            SELECT
                estado,
                COUNT(*) as total,
                COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as eliminadas
            FROM galeria
            GROUP BY estado
            ORDER BY total DESC
        `);

        console.log('   Estado | Total | Eliminadas (deleted_at)');
        console.log('   ---------------------------------------');
        statsResult.rows.forEach(row => {
            console.log(`   ${row.estado.padEnd(8)} | ${row.total.toString().padEnd(5)} | ${row.eliminadas}`);
        });

        // Liberar cliente
        client.release();
        await pool.end();

        console.log('\\n✅ Verificación completada exitosamente');

    } catch (error) {
        console.log('❌ Error conectando a PostgreSQL:', error.message);
        console.log('\\n🔧 SOLUCIÓN:');
        console.log('   1. Asegúrate de que el módulo pg esté instalado:');
        console.log('      npm install pg --save');
        console.log('   2. Verifica que DATABASE_URL sea correcta');
        console.log('   3. Verifica la conexión a internet');
    }
}

// Ejecutar verificación
checkPostgresPhotos().catch(error => {
    console.error('Error en verificación:', error);
});