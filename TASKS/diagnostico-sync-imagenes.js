/**
 * Diagnóstico del problema [IMG-001]: Imágenes no se guardan en Paso 2
 *
 * Este script ayuda a diagnosticar por qué el sync no funciona.
 * Ejecutar: node TASKS/diagnostico-sync-imagenes.js
 */

const pool = require('../backend/db/postgres');

async function diagnosticarSync() {
    console.log('=== DIAGNÓSTICO [IMG-001] ===\n');

    // 1. Verificar conexión a PostgreSQL
    console.log('1. Verificando conexión PostgreSQL...');
    try {
        const { rows } = await pool.query('SELECT NOW() as hora');
        console.log(`   ✅ Conectado a PostgreSQL: ${rows[0].hora}`);
    } catch (err) {
        console.log(`   ❌ Error de conexión: ${err.message}`);
        return;
    }

    // 2. Verificar estructura de tabla galeria
    console.log('\n2. Verificando tabla galeria...');
    try {
        const { rows } = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'galeria'
            ORDER BY ordinal_position
        `);
        console.log(`   ✅ Tabla galeria tiene ${rows.length} columnas:`);
        rows.forEach(r => console.log(`      - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
    } catch (err) {
        console.log(`   ❌ Error al verificar tabla: ${err.message}`);
    }

    // 3. Verificar estructura de tabla propiedades
    console.log('\n3. Verificando tabla propiedades...');
    try {
        const { rows } = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'propiedades'
            ORDER BY ordinal_position
        `);
        console.log(`   ✅ Tabla propiedades tiene ${rows.length} columnas`);
        const tieneMetadata = rows.some(r => r.column_name === 'metadata');
        console.log(`   ${tieneMetadata ? '✅' : '❌'} Columna 'metadata': ${tieneMetadata ? 'EXISTE' : 'NO EXISTE'}`);
    } catch (err) {
        console.log(`   ❌ Error al verificar tabla: ${err.message}`);
    }

    // 4. Verificar datos de ejemplo
    console.log('\n4. Verificando datos de ejemplo...');
    try {
        // Buscar una empresa con propiedades
        const { rows: empresas } = await pool.query(`
            SELECT id, nombre FROM empresas LIMIT 3
        `);

        if (empresas.length === 0) {
            console.log('   ⚠️  No hay empresas en la base de datos');
            return;
        }

        const empresaId = empresas[0].id;
        console.log(`   Empresa: ${empresas[0].nombre} (ID: ${empresaId})`);

        // Buscar propiedades de esta empresa
        const { rows: propiedades } = await pool.query(`
            SELECT id, nombre FROM propiedades
            WHERE empresa_id = $1 LIMIT 3
        `, [empresaId]);

        if (propiedades.length === 0) {
            console.log('   ⚠️  Esta empresa no tiene propiedades');
            return;
        }

        const propiedadId = propiedades[0].id;
        console.log(`   Propiedad: ${propiedades[0].nombre} (ID: ${propiedadId})`);

        // Verificar galería de esta propiedad
        const { rows: fotos } = await pool.query(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN estado IN ('auto','manual') THEN 1 ELSE 0 END) as confirmadas,
                   SUM(CASE WHEN espacio_id IS NOT NULL THEN 1 ELSE 0 END) as clasificadas
            FROM galeria
            WHERE empresa_id = $1 AND propiedad_id = $2
        `, [empresaId, propiedadId]);

        console.log(`   Fotos en galería: ${fotos[0].total || 0}`);
        console.log(`   Fotos confirmadas (auto/manual): ${fotos[0].confirmadas || 0}`);
        console.log(`   Fotos clasificadas (con espacio_id): ${fotos[0].clasificadas || 0}`);

        // Verificar metadata actual
        const { rows: metadata } = await pool.query(`
            SELECT metadata->'websiteData' as websiteData
            FROM propiedades
            WHERE id = $1 AND empresa_id = $2
        `, [propiedadId, empresaId]);

        if (metadata[0]?.websiteData) {
            const wd = metadata[0].websiteData;
            console.log(`   websiteData existe: ${!!wd}`);
            if (wd.images) {
                const espacios = Object.keys(wd.images || {});
                console.log(`   Imágenes en websiteData: ${espacios.length} espacio(s)`);
                espacios.forEach(esp => {
                    console.log(`      - ${esp}: ${wd.images[esp].length} foto(s)`);
                });
            } else {
                console.log(`   websiteData.images: NO EXISTE`);
            }
        } else {
            console.log(`   websiteData: NO EXISTE en metadata`);
        }

    } catch (err) {
        console.log(`   ❌ Error al verificar datos: ${err.message}`);
    }

    // 5. Probar query de syncToWebsite
    console.log('\n5. Probando query de syncToWebsite...');
    try {
        // Necesitamos una empresa y propiedad real
        const { rows: empProp } = await pool.query(`
            SELECT e.id as empresa_id, p.id as propiedad_id
            FROM empresas e
            JOIN propiedades p ON p.empresa_id = e.id
            LIMIT 1
        `);

        if (empProp.length === 0) {
            console.log('   ⚠️  No hay empresa/propiedad para probar');
            return;
        }

        const { empresa_id, propiedad_id } = empProp[0];

        const { rows } = await pool.query(`
            SELECT id, storage_url, alt_text, espacio, espacio_id, orden
            FROM galeria
            WHERE empresa_id=$1 AND propiedad_id=$2 AND estado IN ('auto','manual') AND espacio_id IS NOT NULL
            ORDER BY orden ASC
        `, [empresa_id, propiedad_id]);

        console.log(`   Query ejecutada: ${rows.length} fotos encontradas para sync`);
        if (rows.length > 0) {
            console.log(`   Ejemplo de foto: ID=${rows[0].id}, espacio_id=${rows[0].espacio_id}`);
        }

    } catch (err) {
        console.log(`   ❌ Error en query sync: ${err.message}`);
        console.log(`   SQL error detail: ${err.detail || 'N/A'}`);
    }

    console.log('\n=== RECOMENDACIONES ===');
    console.log('1. Verificar logs del servidor cuando se llama a /galeria/:id/sync');
    console.log('2. Probar endpoint manualmente con curl o Postman');
    console.log('3. Verificar que las fotos tengan estado "auto" o "manual" y espacio_id no nulo');
    console.log('4. Verificar que la columna "metadata" en "propiedades" acepte JSONB');
}

// Ejecutar diagnóstico
diagnosticarSync().catch(err => {
    console.error('Error en diagnóstico:', err);
});