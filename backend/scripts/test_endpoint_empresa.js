// Probar endpoint /empresa directamente
const { Pool } = require('pg');
require('dotenv').config();

// Simular la función obtenerDetallesEmpresa
async function testObtenerDetallesEmpresa() {
    console.log('=== PRUEBA DE obtenerDetallesEmpresa ===\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        const empresaId = 'SdPX7OBmThlOldlxsIq8'; // ID de Orillas del Coilaco

        // 1. Ejecutar la query exacta que usa obtenerDetallesEmpresa
        console.log('📋 Ejecutando query de obtenerDetallesEmpresa...');
        const { rows } = await pool.query('SELECT * FROM empresas WHERE id = $1', [empresaId]);

        if (!rows[0]) {
            console.error('❌ Empresa no encontrada');
            return;
        }

        const row = rows[0];
        console.log('✅ Query exitosa');

        // 2. Aplicar mapearEmpresa (la función real)
        function mapearEmpresa(row) {
            if (!row) return null;
            return {
                id: row.id,
                nombre: row.nombre,
                email: row.email,
                plan: row.plan,
                dominio: row.dominio,
                subdominio: row.subdominio,
                google_maps_url: row.google_maps_url || null,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                ...(row.configuracion || {})
            };
        }

        const resultado = mapearEmpresa(row);

        console.log('\n📊 RESULTADO DE mapearEmpresa:');
        console.log(`- ID: ${resultado.id}`);
        console.log(`- Nombre: ${resultado.nombre}`);
        console.log(`- Tiene websiteSettings: ${!!resultado.websiteSettings}`);

        if (resultado.websiteSettings) {
            console.log('\n🔍 websiteSettings:');
            console.log(JSON.stringify(resultado.websiteSettings, null, 2));

            // Verificar campos específicos
            console.log('\n✅ CAMPOS ESPECÍFICOS:');
            console.log(`✓ websiteSettings.subdomain: ${resultado.websiteSettings.subdomain || 'NO'}`);
            console.log(`✓ websiteSettings.domain: ${resultado.websiteSettings.domain || 'NO'}`);
            console.log(`✓ websiteSettings.general.subdomain: ${resultado.websiteSettings.general?.subdomain || 'NO'}`);
            console.log(`✓ websiteSettings.theme.heroImageAlt: ${resultado.websiteSettings.theme?.heroImageAlt || 'NO'}`);
            console.log(`✓ websiteSettings.theme.heroImageTitle: ${resultado.websiteSettings.theme?.heroImageTitle || 'NO'}`);
            console.log(`✓ websiteSettings.theme.heroImageUrl: ${resultado.websiteSettings.theme?.heroImageUrl || 'NO'}`);
        } else {
            console.log('❌ websiteSettings NO está en el resultado');
        }

        // 3. Verificar la estructura completa
        console.log('\n🔍 ESTRUCTURA COMPLETA DEL RESULTADO:');
        console.log('Claves principales:', Object.keys(resultado));

        // 4. Probar también la query del tenantResolver
        console.log('\n=== PRUEBA DE TENANT RESOLVER ===');
        const subdomain = 'prueba-test';

        console.log(`\n🔍 Buscando empresa por subdomain: ${subdomain}`);

        // Query 1: subdominio en columna
        const { rows: rows1 } = await pool.query('SELECT * FROM empresas WHERE subdominio = $1 LIMIT 1', [subdomain]);
        console.log(`✓ Query 1 (subdominio columna): ${rows1.length > 0 ? 'ENCONTRADA' : 'NO'}`);

        // Query 2: subdomain en websiteSettings
        const { rows: rows2 } = await pool.query(
            `SELECT * FROM empresas
             WHERE configuracion->>'websiteSettings' IS NOT NULL
               AND configuracion->'websiteSettings'->>'subdomain' = $1
             LIMIT 1`,
            [subdomain]
        );
        console.log(`✓ Query 2 (websiteSettings.subdomain): ${rows2.length > 0 ? 'ENCONTRADA' : 'NO'}`);

        // Query 3: subdomain en websiteSettings.general
        const { rows: rows3 } = await pool.query(
            `SELECT * FROM empresas
             WHERE configuracion->>'websiteSettings' IS NOT NULL
               AND configuracion->'websiteSettings'->'general'->>'subdomain' = $1
             LIMIT 1`,
            [subdomain]
        );
        console.log(`✓ Query 3 (websiteSettings.general.subdomain): ${rows3.length > 0 ? 'ENCONTRADA' : 'NO'}`);

    } catch (error) {
        console.error('❌ ERROR:', error);
    } finally {
        await pool.end();
        console.log('\n=== PRUEBA FINALIZADA ===');
    }
}

// Ejecutar la prueba
testObtenerDetallesEmpresa().catch(console.error);