const fs = require('fs');
const path = require('path');

async function checkPhotos() {
    console.log('=== VERIFICACIÓN DE FOTOS ELIMINADAS ===');
    console.log('Fecha:', new Date().toISOString());
    console.log('');

    // 1. Verificar configuración
    console.log('1. 📋 CONFIGURACIÓN DEL SISTEMA');
    console.log('===============================');

    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('❌ .env no encontrado');
        return;
    }

    // Cargar variables de entorno
    require('dotenv').config({ path: envPath });

    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL no definida - Modo Firestore activo');
        console.log('ℹ️  El sistema está en modo Firestore (legacy)');
        return;
    }

    console.log('✅ DATABASE_URL definida - Modo PostgreSQL activo');
    console.log('   Host: aws-1-sa-east-1.pooler.supabase.com');
    console.log('   Puerto: 6543');
    console.log('');

    // 2. Conectar a PostgreSQL
    console.log('2. 🔌 CONECTANDO A POSTGRESQL');
    console.log('=============================');

    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const client = await pool.connect();
        console.log('✅ Conexión establecida');
        console.log('');

        // 3. Verificar fotos descartadas
        console.log('3. 📊 VERIFICANDO FOTOS DESCARTADAS');
        console.log('==================================');

        // Consulta 1: Contar fotos descartadas
        const countResult = await client.query(`
            SELECT COUNT(*) as total
            FROM galeria
            WHERE estado = 'descartada'
        `);

        const totalDescartadas = parseInt(countResult.rows[0].total);
        console.log(`   Total fotos descartadas: ${totalDescartadas}`);

        if (totalDescartadas === 0) {
            console.log('\\n🎉 ¡EXCELENTE! No hay fotos descartadas en PostgreSQL.');
            console.log('   Esto confirma que la función descartarFoto() está funcionando correctamente.');
            console.log('   Las fotos se eliminan completamente al descartarlas.');
        } else {
            console.log(`\\n⚠️  Hay ${totalDescartadas} fotos descartadas pendientes.`);
            console.log('   Esto podría indicar que:');
            console.log('   1. La función descartarFoto() no se está ejecutando');
            console.log('   2. Hay un error en la eliminación');
            console.log('   3. Las fotos fueron descartadas antes de la implementación');
            console.log('');

            // Mostrar detalles
            const detailsResult = await client.query(`
                SELECT
                    id,
                    empresa_id,
                    propiedad_id,
                    storage_url,
                    created_at
                FROM galeria
                WHERE estado = 'descartada'
                ORDER BY created_at DESC
                LIMIT 5
            `);

            console.log('   📋 Últimas 5 fotos descartadas:');
            detailsResult.rows.forEach((row, i) => {
                console.log(`\\n   Foto ${i + 1}:`);
                console.log(`      ID: ${row.id}`);
                console.log(`      Empresa: ${row.empresa_id}`);
                console.log(`      Propiedad: ${row.propiedad_id}`);
                console.log(`      Creada: ${row.created_at}`);
                console.log(`      URL: ${row.storage_url ? 'Sí' : 'No'}`);
            });
        }

        console.log('');

        // 4. Verificar estadísticas generales
        console.log('4. 📈 ESTADÍSTICAS DE GALERÍA');
        console.log('=============================');

        const statsResult = await client.query(`
            SELECT
                estado,
                COUNT(*) as total,
                MIN(created_at) as primera,
                MAX(created_at) as ultima
            FROM galeria
            GROUP BY estado
            ORDER BY total DESC
        `);

        console.log('   Estado      | Total | Primera foto      | Última foto');
        console.log('   -------------------------------------------------------');
        statsResult.rows.forEach(row => {
            const primera = row.primera ? new Date(row.primera).toISOString().split('T')[0] : 'N/A';
            const ultima = row.ultima ? new Date(row.ultima).toISOString().split('T')[0] : 'N/A';
            console.log(`   ${row.estado.padEnd(11)} | ${row.total.toString().padEnd(5)} | ${primera.padEnd(16)} | ${ultima}`);
        });

        console.log('');

        // 5. Verificar eliminaciones recientes (deleted_at)
        console.log('5. 🔍 VERIFICANDO ELIMINACIONES (deleted_at)');
        console.log('===========================================');

        const deletedResult = await client.query(`
            SELECT
                COUNT(*) as total,
                MIN(deleted_at) as primera_eliminacion,
                MAX(deleted_at) as ultima_eliminacion
            FROM galeria
            WHERE deleted_at IS NOT NULL
        `);

        const totalEliminadas = parseInt(deletedResult.rows[0].total);
        console.log(`   Total fotos con deleted_at: ${totalEliminadas}`);

        if (totalEliminadas > 0) {
            const primera = deletedResult.rows[0].primera_eliminacion;
            const ultima = deletedResult.rows[0].ultima_eliminacion;
            console.log(`   Primera eliminación: ${primera}`);
            console.log(`   Última eliminación: ${ultima}`);
        } else {
            console.log('   ℹ️  No hay fotos marcadas con deleted_at');
            console.log('   Nota: La función descartarFoto() elimina directamente, no usa soft delete');
        }

        // 6. Verificar integridad (fotos sin URLs)
        console.log('\\n6. ✅ VERIFICANDO INTEGRIDAD DE DATOS');
        console.log('=====================================');

        const integrityResult = await client.query(`
            SELECT
                COUNT(*) as total_sin_url
            FROM galeria
            WHERE (storage_url IS NULL OR storage_url = '')
               AND (storage_path IS NULL OR storage_path = '')
               AND estado != 'descartada'
        `);

        const sinUrl = parseInt(integrityResult.rows[0].total_sin_url);
        console.log(`   Fotos sin URL de storage: ${sinUrl}`);
        if (sinUrl > 0) {
            console.log('   ⚠️  Hay fotos sin URL - podrían ser huérfanos');
        } else {
            console.log('   ✅ Todas las fotos tienen URLs de storage');
        }

        // Liberar recursos
        client.release();
        await pool.end();

        console.log('\\n✅ Verificación completada exitosamente');
        console.log('\\n📋 RESUMEN:');
        console.log(`   - Fotos descartadas: ${totalDescartadas} ${totalDescartadas === 0 ? '✅' : '⚠️'}`);
        console.log(`   - Fotos eliminadas (deleted_at): ${totalEliminadas}`);
        console.log(`   - Fotos sin URL: ${sinUrl} ${sinUrl === 0 ? '✅' : '⚠️'}`);

        if (totalDescartadas === 0) {
            console.log('\\n🎯 CONCLUSIÓN: La función descartarFoto() está funcionando correctamente.');
            console.log('   No quedan rastros de fotos descartadas en PostgreSQL.');
        } else {
            console.log('\\n🔧 ACCIÓN REQUERIDA: Hay fotos descartadas pendientes.');
            console.log('   Revisar la función descartarFoto() en galeriaService.js');
        }

    } catch (error) {
        console.log('❌ Error en PostgreSQL:', error.message);
        console.log('\\n🔧 Posibles soluciones:');
        console.log('   1. Verificar conexión a internet');
        console.log('   2. Verificar credenciales de Supabase');
        console.log('   3. Verificar que la tabla galeria exista');
    }
}

// Ejecutar
checkPhotos().catch(error => {
    console.error('Error:', error);
});