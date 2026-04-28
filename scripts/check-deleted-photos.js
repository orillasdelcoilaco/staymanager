const fs = require('fs');
const path = require('path');

async function main() {
    console.log('=== VERIFICACIÓN DE FOTOS ELIMINADAS ===');
    console.log('Fecha:', new Date().toISOString());
    console.log('');

    // 1. Verificar configuración
    console.log('1. CONFIGURACIÓN DEL SISTEMA');
    console.log('============================');

    const envPath = path.join(__dirname, '../backend/.env');
    let databaseUrlDefined = false;
    let empresaId = null;

    try {
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            databaseUrlDefined = envContent.includes('DATABASE_URL=');
            console.log('✅ .env encontrado');
            console.log('   DATABASE_URL definida:', databaseUrlDefined ? 'SÍ' : 'NO');

            // Buscar empresaId en config
            const configPath = path.join(__dirname, '../backend/config/aiConfig.js');
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const empresaMatch = configContent.match(/empresaId:\s*['"]([^'"]+)['"]/);
                if (empresaMatch) {
                    empresaId = empresaMatch[1];
                    console.log('   Empresa ID desde config:', empresaId);
                }
            }
        } else {
            console.log('❌ .env no encontrado en:', envPath);
        }
    } catch (error) {
        console.log('❌ Error leyendo configuración:', error.message);
    }

    console.log('');

    // 2. Verificar PostgreSQL
    console.log('2. VERIFICACIÓN POSTGRESQL');
    console.log('==========================');

    if (databaseUrlDefined) {
        try {
            // Cargar variables de entorno
            require('dotenv').config({ path: envPath });
            const { Pool } = require('pg');

            const pool = new Pool({
                connectionString: process.env.DATABASE_URL
            });

            console.log('✅ Conectando a PostgreSQL...');

            // Consultar fotos descartadas
            const result = await pool.query(`
                SELECT
                    COUNT(*) as total,
                    empresa_id,
                    propiedad_id
                FROM galeria
                WHERE estado = 'descartada'
                GROUP BY empresa_id, propiedad_id
                ORDER BY total DESC
            `);

            console.log('   Resultados:');
            if (result.rows.length === 0) {
                console.log('   ✅ No hay fotos descartadas en PostgreSQL');
            } else {
                result.rows.forEach(row => {
                    console.log(`   - Empresa: ${row.empresa_id}, Propiedad: ${row.propiedad_id}`);
                    console.log(`     Fotos descartadas: ${row.total}`);
                });
            }

            await pool.end();
        } catch (error) {
            console.log('❌ Error PostgreSQL:', error.message);
        }
    } else {
        console.log('ℹ️  PostgreSQL no configurado (modo Firestore activo)');
    }

    console.log('');

    // 3. Verificar Firestore
    console.log('3. VERIFICACIÓN FIRESTORE');
    console.log('=========================');

    try {
        const admin = require('firebase-admin');

        // Verificar credenciales
        const serviceAccountPath = path.join(__dirname, '../backend/serviceAccountKey.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.log('❌ serviceAccountKey.json no encontrado en:', serviceAccountPath);
            console.log('   No se puede verificar Firestore sin credenciales');
        } else {
            console.log('✅ Credenciales Firebase encontradas');

            // Inicializar si no está inicializado
            if (admin.apps.length === 0) {
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                console.log('✅ Firebase Admin inicializado');
            }

            const db = admin.firestore();

            // Buscar empresas
            const empresasSnapshot = await db.collection('empresas').limit(2).get();

            console.log('   Empresas encontradas:', empresasSnapshot.size);

            for (const empresaDoc of empresasSnapshot.docs) {
                const currentEmpresaId = empresaDoc.id;
                console.log(`\n   🔍 Empresa: ${currentEmpresaId}`);

                // Buscar propiedades
                const propiedadesSnapshot = await empresaDoc.ref.collection('propiedades').limit(2).get();

                for (const propiedadDoc of propiedadesSnapshot.docs) {
                    const propiedadId = propiedadDoc.id;

                    // Contar fotos descartadas
                    const descartadasSnapshot = await propiedadDoc.ref.collection('galeria')
                        .where('estado', '==', 'descartada')
                        .get();

                    console.log(`     📷 Propiedad: ${propiedadId}`);
                    console.log(`       Fotos descartadas: ${descartadasSnapshot.size}`);

                    if (descartadasSnapshot.size > 0) {
                        // Mostrar algunas fotos
                        descartadasSnapshot.docs.slice(0, 3).forEach(doc => {
                            const data = doc.data();
                            console.log(`       - ${doc.id}: ${data.storageUrl || 'Sin URL'}`);
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.log('❌ Error Firestore:', error.message);
    }

    console.log('');

    // 4. Verificar logs
    console.log('4. VERIFICACIÓN DE LOGS');
    console.log('=======================');

    const logPath = path.join(__dirname, '../backend/logs/server.log');
    if (fs.existsSync(logPath)) {
        try {
            const logContent = fs.readFileSync(logPath, 'utf8');
            const lines = logContent.split('\n');

            // Buscar líneas de eliminación en las últimas 100 líneas
            const recentLines = lines.slice(-100);
            const deleteLines = recentLines.filter(line =>
                line.toLowerCase().includes('elimin') ||
                line.toLowerCase().includes('delete') ||
                line.toLowerCase().includes('descartar')
            );

            if (deleteLines.length > 0) {
                console.log('✅ Logs de eliminación encontrados:');
                deleteLines.forEach(line => {
                    console.log(`   ${line.substring(0, 80)}...`);
                });
            } else {
                console.log('ℹ️  No se encontraron logs recientes de eliminación');
            }
        } catch (error) {
            console.log('❌ Error leyendo logs:', error.message);
        }
    } else {
        console.log('ℹ️  Archivo de logs no encontrado:', logPath);
    }

    console.log('\n=== RESUMEN ===');
    console.log(`Modo: ${databaseUrlDefined ? 'PostgreSQL' : 'Firestore'}`);
    console.log(`Empresa: ${empresaId || 'No identificada'}`);
    console.log('\n✅ Verificación completada');
}

main().catch(error => {
    console.error('Error en verificación:', error);
});