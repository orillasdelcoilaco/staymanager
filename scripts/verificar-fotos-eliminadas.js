#!/usr/bin/env node
/**
 * Script para verificar fotos eliminadas en PostgreSQL y Firestore
 * Verifica que no queden rastros de fotos descartadas/eliminadas
 */

const fs = require('fs');
const path = require('path');

console.log('=== VERIFICACIÓN DE FOTOS ELIMINADAS ===');
console.log('Fecha:', new Date().toISOString());
console.log('');

// 1. Verificar configuración del sistema
console.log('1. CONFIGURACIÓN DEL SISTEMA');
console.log('============================');

const envPath = path.join(__dirname, '../backend/.env');
let databaseUrlDefined = false;
let empresaId = null;
let propiedadIdEjemplo = null;

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

// 2. Verificar PostgreSQL (si está configurado)
console.log('2. VERIFICACIÓN POSTGRESQL');
console.log('==========================');

if (databaseUrlDefined) {
    try {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL || require('dotenv').config({ path: envPath }).parsed.DATABASE_URL
        });

        // Consultar fotos en estado 'descartada'
        const result = await pool.query(`
            SELECT
                COUNT(*) as total_descartadas,
                COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as eliminadas_completamente,
                empresa_id,
                propiedad_id
            FROM galeria
            WHERE estado = 'descartada'
            GROUP BY empresa_id, propiedad_id
            ORDER BY total_descartadas DESC
            LIMIT 10
        `);

        console.log('✅ PostgreSQL conectado');
        console.log('   Total fotos descartadas por empresa/propiedad:');
        result.rows.forEach(row => {
            console.log(`   - Empresa: ${row.empresa_id}, Propiedad: ${row.propiedad_id}`);
            console.log(`     Total descartadas: ${row.total_descartadas}`);
            console.log(`     Eliminadas completamente: ${row.eliminadas_completamente}`);
            console.log(`     Pendientes de eliminar: ${row.total_descartadas - row.eliminadas_completamente}`);
        });

        if (result.rows.length === 0) {
            console.log('   ✅ No hay fotos descartadas en PostgreSQL');
        }

        await pool.end();
    } catch (error) {
        console.log('❌ Error conectando a PostgreSQL:', error.message);
    }
} else {
    console.log('ℹ️  PostgreSQL no configurado (modo Firestore activo)');
}

console.log('');

// 3. Verificar Firestore
console.log('3. VERIFICACIÓN FIRESTORE');
console.log('=========================');

try {
    // Intentar inicializar Firebase Admin
    const admin = require('firebase-admin');

    // Verificar si ya está inicializado
    if (!admin.apps.length) {
        try {
            const serviceAccount = require(path.join(__dirname, '../backend/serviceAccountKey.json'));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('✅ Firebase Admin inicializado');
        } catch (error) {
            console.log('❌ No se pudo inicializar Firebase Admin:', error.message);
            console.log('   Verifica que serviceAccountKey.json exista en backend/');
        }
    } else {
        console.log('✅ Firebase Admin ya inicializado');
    }

    if (admin.apps.length > 0) {
        const db = admin.firestore();

        // Buscar empresas para verificar
        const empresasSnapshot = await db.collection('empresas').limit(3).get();

        console.log('   Empresas encontradas:', empresasSnapshot.size);

        for (const empresaDoc of empresasSnapshot.docs) {
            const empresaId = empresaDoc.id;
            console.log(`\n   🔍 Empresa: ${empresaId}`);

            // Buscar propiedades
            const propiedadesSnapshot = await empresaDoc.ref.collection('propiedades').limit(3).get();

            for (const propiedadDoc of propiedadesSnapshot.docs) {
                const propiedadId = propiedadDoc.id;

                // Buscar fotos descartadas en galeria
                const galeriaSnapshot = await propiedadDoc.ref.collection('galeria')
                    .where('estado', '==', 'descartada')
                    .limit(10)
                    .get();

                console.log(`     📷 Propiedad: ${propiedadId}`);
                console.log(`       Fotos descartadas: ${galeriaSnapshot.size}`);

                if (galeriaSnapshot.size > 0) {
                    galeriaSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        console.log(`       - Foto: ${doc.id}`);
                        console.log(`         URL: ${data.storageUrl || data.storagePath || 'Sin URL'}`);
                        console.log(`         Creada: ${data.createdAt || 'Sin fecha'}`);
                    });
                } else {
                    console.log(`       ✅ No hay fotos descartadas`);
                }
            }
        }
    }
} catch (error) {
    console.log('❌ Error verificando Firestore:', error.message);
}

console.log('');

// 4. Verificar logs recientes de eliminación
console.log('4. VERIFICACIÓN DE LOGS');
console.log('=======================');

const logFiles = [
    path.join(__dirname, '../logs/server.log'),
    path.join(__dirname, '../backend/logs/server.log'),
    path.join(__dirname, '../backend/logs/error.log')
];

let logsEncontrados = false;

logFiles.forEach(logFile => {
    if (fs.existsSync(logFile)) {
        try {
            const logContent = fs.readFileSync(logFile, 'utf8');
            const lines = logContent.split('\n').reverse().slice(0, 50); // Últimas 50 líneas

            const eliminacionLines = lines.filter(line =>
                line.toLowerCase().includes('elimin') ||
                line.toLowerCase().includes('delete') ||
                line.toLowerCase().includes('descartar')
            );

            if (eliminacionLines.length > 0) {
                logsEncontrados = true;
                console.log(`✅ Logs encontrados en: ${logFile}`);
                console.log('   Últimas eliminaciones registradas:');
                eliminacionLines.slice(0, 5).forEach(line => {
                    console.log(`   - ${line.substring(0, 100)}...`);
                });
            }
        } catch (error) {
            console.log(`❌ Error leyendo log ${logFile}:`, error.message);
        }
    }
});

if (!logsEncontrados) {
    console.log('ℹ️  No se encontraron logs recientes de eliminación');
}

console.log('');

// 5. Resumen y recomendaciones
console.log('5. RESUMEN Y RECOMENDACIONES');
console.log('============================');

console.log('📊 ESTADO ACTUAL:');
console.log(`   - Modo: ${databaseUrlDefined ? 'PostgreSQL' : 'Firestore'}`);
console.log(`   - Empresa ID: ${empresaId || 'No identificada'}`);

if (databaseUrlDefined) {
    console.log('\n🔍 PARA POSTGRESQL:');
    console.log('   Ejecutar manualmente:');
    console.log('   SELECT COUNT(*) FROM galeria WHERE estado = \'descartada\';');
    console.log('   SELECT * FROM galeria WHERE estado = \'descartada\' LIMIT 5;');
} else {
    console.log('\n🔍 PARA FIRESTORE:');
    console.log('   Verificar en Firebase Console:');
    console.log('   1. Ir a Firestore Database');
    console.log('   2. Buscar colección: empresas/{empresaId}/propiedades/{propiedadId}/galeria');
    console.log('   3. Filtrar por: estado = "descartada"');
}

console.log('\n✅ ACCIONES COMPLETADAS:');
console.log('   1. Verificación de configuración del sistema');
console.log('   2. Verificación PostgreSQL (si aplica)');
console.log('   3. Verificación Firestore');
console.log('   4. Revisión de logs');

console.log('\n⚠️  SI HAY FOTOS DESCARTADAS:');
console.log('   - Verificar que la función descartarFoto() esté funcionando');
console.log('   - Probar eliminación manual desde la UI');
console.log('   - Monitorear logs del servidor');

console.log('\n=== FIN DE VERIFICACIÓN ===');