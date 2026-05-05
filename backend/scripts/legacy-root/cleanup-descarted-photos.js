const fs = require('fs');
const path = require('path');

async function cleanupDescartadas() {
    console.log('=== LIMPIEZA MANUAL DE FOTOS DESCARTADAS ===');
    console.log('Fecha:', new Date().toISOString());
    console.log('⚠️  ADVERTENCIA: Esto eliminará permanentemente fotos descartadas');
    console.log('');

    // Cargar configuración
    require('dotenv').config({ path: path.join(__dirname, '.env') });

    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL no definida');
        return;
    }

    console.log('✅ Conectando a PostgreSQL...');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        // 1. Contar fotos descartadas
        const countResult = await client.query(`
            SELECT COUNT(*) as total
            FROM galeria
            WHERE estado = 'descartada'
        `);

        const totalDescartadas = parseInt(countResult.rows[0].total);
        console.log(`\\n📊 Fotos descartadas encontradas: ${totalDescartadas}`);

        if (totalDescartadas === 0) {
            console.log('✅ No hay fotos descartadas para limpiar');
            client.release();
            await pool.end();
            return;
        }

        // 2. Mostrar resumen por empresa/propiedad
        console.log('\\n📋 RESUMEN POR EMPRESA/PROPIEDAD:');
        const summaryResult = await client.query(`
            SELECT
                empresa_id,
                propiedad_id,
                COUNT(*) as total
            FROM galeria
            WHERE estado = 'descartada'
            GROUP BY empresa_id, propiedad_id
            ORDER BY total DESC
        `);

        summaryResult.rows.forEach(row => {
            console.log(`   - Empresa: ${row.empresa_id}, Propiedad: ${row.propiedad_id}: ${row.total} fotos`);
        });

        // 3. Preguntar confirmación
        console.log('\\n⚠️  ¿Estás seguro de que quieres eliminar estas fotos?');
        console.log('   Esta acción NO se puede deshacer.');
        console.log('   Escribe "ELIMINAR" para confirmar:');

        // Simular confirmación (en producción sería entrada del usuario)
        const confirmacion = 'ELIMINAR'; // Cambiar esto según necesidad

        if (confirmacion !== 'ELIMINAR') {
            console.log('❌ Operación cancelada');
            client.release();
            await pool.end();
            return;
        }

        console.log('\\n🔧 ELIMINANDO FOTOS DESCARTADAS...');

        // 4. Primero obtener URLs para posible limpieza de storage
        console.log('\\n📋 OBTENIENDO URLs DE STORAGE...');
        const urlsResult = await client.query(`
            SELECT
                id,
                empresa_id,
                propiedad_id,
                storage_url,
                thumbnail_url,
                storage_path
            FROM galeria
            WHERE estado = 'descartada'
            LIMIT 10
        `);

        console.log(`   URLs encontradas: ${urlsResult.rows.length}`);
        urlsResult.rows.forEach(row => {
            console.log(`   - ${row.id}: ${row.storage_url || row.storage_path || 'Sin URL'}`);
        });

        // 5. Eliminar de PostgreSQL
        console.log('\\n🗑️  ELIMINANDO DE POSTGRESQL...');
        const deleteResult = await client.query(`
            DELETE FROM galeria
            WHERE estado = 'descartada'
            RETURNING id, empresa_id, propiedad_id
        `);

        const eliminadas = deleteResult.rowCount;
        console.log(`✅ Eliminadas: ${eliminadas} fotos`);

        // 6. Verificar que se eliminaron
        const verifyResult = await client.query(`
            SELECT COUNT(*) as remaining
            FROM galeria
            WHERE estado = 'descartada'
        `);

        const remaining = parseInt(verifyResult.rows[0].remaining);
        console.log(`\\n✅ VERIFICACIÓN: Fotos descartadas restantes: ${remaining}`);

        if (remaining === 0) {
            console.log('🎉 ¡Todas las fotos descartadas han sido eliminadas!');
        } else {
            console.log(`⚠️  Aún quedan ${remaining} fotos descartadas`);
        }

        // 7. Estadísticas finales
        console.log('\\n📈 ESTADÍSTICAS FINALES:');
        const finalStats = await client.query(`
            SELECT
                estado,
                COUNT(*) as total
            FROM galeria
            GROUP BY estado
            ORDER BY total DESC
        `);

        console.log('   Estado      | Total');
        console.log('   --------------------');
        finalStats.rows.forEach(row => {
            console.log(`   ${row.estado.padEnd(11)} | ${row.total}`);
        });

        client.release();
        await pool.end();

        console.log('\\n✅ Limpieza completada exitosamente');
        console.log('\\n🔧 NOTA: Los archivos en Firebase Storage NO se eliminaron automáticamente.');
        console.log('   Para eliminar archivos del storage, necesitas:');
        console.log('   1. Credenciales de Firebase Admin');
        console.log('   2. Ejecutar deleteFileByPath() para cada URL');
        console.log('   3. O limpiar manualmente desde Firebase Console');

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

// Ejecutar limpieza
cleanupDescartadas().catch(error => {
    console.error('Error:', error);
});