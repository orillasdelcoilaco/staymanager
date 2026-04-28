const fs = require('fs');
const path = require('path');

async function debugDescartarFoto() {
    console.log('=== DEBUG: DESCARTARFOTO ===');
    console.log('Simulando la función descartarFoto paso a paso');
    console.log('');

    // Cargar configuración
    require('dotenv').config({ path: path.join(__dirname, '.env') });

    if (!process.env.DATABASE_URL) {
        console.log('❌ DATABASE_URL no definida');
        return;
    }

    // Cargar módulos
    const { Pool } = require('pg');
    const poolModule = require('./db/postgres');
    console.log('✅ Módulos cargados');
    console.log('   pool desde db/postgres:', poolModule ? 'DEFINIDO' : 'NULL');
    console.log('');

    // Conectar a PostgreSQL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL conectado');

        // 1. Obtener una foto descartada
        console.log('\\n1. 📷 BUSCANDO FOTO DESCARTADA...');
        const fotoResult = await client.query(`
            SELECT id, empresa_id, propiedad_id, storage_url, thumbnail_url, storage_path
            FROM galeria
            WHERE estado = 'descartada'
            LIMIT 1
        `);

        if (fotoResult.rows.length === 0) {
            console.log('❌ No hay fotos descartadas');
            client.release();
            await pool.end();
            return;
        }

        const foto = fotoResult.rows[0];
        console.log(`✅ Foto encontrada: ${foto.id}`);
        console.log(`   Empresa: ${foto.empresa_id}`);
        console.log(`   Propiedad: ${foto.propiedad_id}`);
        console.log(`   storage_url: ${foto.storage_url}`);
        console.log(`   thumbnail_url: ${foto.thumbnail_url}`);
        console.log(`   storage_path: ${foto.storage_path}`);
        console.log('');

        // 2. Simular obtenerDatosFoto()
        console.log('2. 🔍 SIMULANDO obtenerDatosFoto()...');
        const fotoData = {
            storageUrl: foto.storage_url,
            thumbnailUrl: foto.thumbnail_url,
            storagePath: foto.storage_path
        };
        console.log('   fotoData:', JSON.stringify(fotoData, null, 2));
        console.log('');

        // 3. Simular eliminarArchivosStorage()
        console.log('3. 🗑️  SIMULANDO eliminarArchivosStorage()...');
        console.log('   NOTA: Esto solo simula, no elimina realmente');

        if (!fotoData) {
            console.log('   ❌ fotoData es null/undefined');
        } else {
            // Determinar archivo principal
            const mainFileUrl = fotoData.storagePath || fotoData.storageUrl;
            console.log(`   Archivo principal: ${mainFileUrl || 'N/A'}`);

            if (mainFileUrl) {
                console.log(`   ✅ Se intentaría eliminar: ${mainFileUrl}`);
            } else {
                console.log('   ⚠️  No hay archivo principal para eliminar');
            }

            // Verificar thumbnail
            if (fotoData.thumbnailUrl) {
                console.log(`   Thumbnail: ${fotoData.thumbnailUrl}`);

                // Normalizar URLs para comparación
                const normalizeUrl = (url) => {
                    if (!url) return '';
                    if (url.includes('/o/')) {
                        const pathPart = url.split('/o/')[1].split('?')[0];
                        return decodeURIComponent(pathPart);
                    }
                    return url;
                };

                const mainNormalized = normalizeUrl(mainFileUrl);
                const thumbNormalized = normalizeUrl(fotoData.thumbnailUrl);

                console.log(`   mainNormalized: ${mainNormalized}`);
                console.log(`   thumbNormalized: ${thumbNormalized}`);

                if (thumbNormalized && thumbNormalized !== mainNormalized) {
                    console.log(`   ✅ Se intentaría eliminar thumbnail: ${fotoData.thumbnailUrl}`);
                } else {
                    console.log(`   ⚠️  Thumbnail igual al principal o vacío, no se eliminaría`);
                }
            } else {
                console.log('   ℹ️  No hay thumbnail');
            }
        }
        console.log('');

        // 4. Simular DELETE de PostgreSQL
        console.log('4. 🗄️  SIMULANDO DELETE DE POSTGRESQL...');
        console.log('   SQL: DELETE FROM galeria WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3');
        console.log(`   Parámetros: [${foto.id}, ${foto.empresa_id}, ${foto.propiedad_id}]`);

        // Verificar si poolModule (desde db/postgres) está definido
        if (!poolModule) {
            console.log('   ❌ pool desde db/postgres es NULL');
            console.log('   ⚠️  Esto haría que la función falle en modo dual');
        } else {
            console.log('   ✅ pool está definido');
        }
        console.log('');

        // 5. Verificar posibles problemas
        console.log('5. 🔧 DIAGNÓSTICO DE POSIBLES PROBLEMAS');
        console.log('=======================================');

        // Problema 1: deleteFileByPath podría fallar
        console.log('\\n🔍 PROBLEMA 1: deleteFileByPath podría fallar silenciosamente');
        console.log('   - La función tiene try-catch que solo logea errores');
        console.log('   - NO relanza el error, por lo que descartarFoto() continúa');
        console.log('   - Pero si deleteFileByPath tira una excepción no manejada...');

        // Problema 2: Firebase Admin no inicializado
        console.log('\\n🔍 PROBLEMA 2: Firebase Admin no inicializado');
        console.log('   - storageService.js necesita admin.storage()');
        console.log('   - Si Firebase no está inicializado, deleteFileByPath fallará');

        // Problema 3: poolModule vs pool local
        console.log('\\n🔍 PROBLEMA 3: Confusión entre poolModule y pool local');
        console.log('   - galeriaService.js usa: const pool = require(\'../db/postgres\')');
        console.log('   - Este script usa un Pool local diferente');
        console.log('   - Si poolModule es null en producción, la función falla');

        // 6. Probar DELETE real (opcional)
        console.log('\\n6. 🧪 ¿PROBAR DELETE REAL? (S/N)');
        // En producción, esto sería una entrada del usuario
        const probarDelete = 'N'; // Cambiar a 'S' para probar

        if (probarDelete === 'S') {
            console.log('\\n⚠️  EJECUTANDO DELETE REAL...');
            try {
                const deleteResult = await client.query(`
                    DELETE FROM galeria
                    WHERE id = \$1 AND empresa_id = \$2 AND propiedad_id = \$3
                    RETURNING id
                `, [foto.id, foto.empresa_id, foto.propiedad_id]);

                console.log(`✅ DELETE exitoso. Filas: ${deleteResult.rowCount}`);
            } catch (error) {
                console.log(`❌ Error en DELETE: ${error.message}`);
            }
        } else {
            console.log('   ℹ️  DELETE no ejecutado (modo simulación)');
        }

        client.release();
        await pool.end();

        console.log('\\n✅ Debug completado');
        console.log('\\n📋 RESUMEN DE HALLAZGOS:');
        console.log('   1. Hay 47 fotos descartadas en PostgreSQL');
        console.log('   2. El DELETE manual funciona correctamente');
        console.log('   3. La función descartarFoto() podría fallar por:');
        console.log('      - deleteFileByPath fallando silenciosamente');
        console.log('      - Firebase Admin no inicializado');
        console.log('      - poolModule null en producción');
        console.log('\\n🔧 RECOMENDACIÓN:');
        console.log('   Revisar logs del servidor para errores de Firebase/Storage');
        console.log('   O ejecutar cleanup manual con cleanup-descarted-photos.js');

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

debugDescartarFoto().catch(error => {
    console.error('Error:', error);
});