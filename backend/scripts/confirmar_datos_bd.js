// CONFIRMACIÓN DIRECTA DE DATOS EN BASE DE DATOS
const { Pool } = require('pg');
require('dotenv').config();

async function confirmarDatosBD() {
    console.log('🔍 CONFIRMACIÓN DIRECTA DE DATOS EN POSTGRESQL\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // 1. CONSULTA DIRECTA A LA TABLA empresas
        console.log('📋 EJECUTANDO CONSULTA SQL DIRECTA:');
        console.log('SELECT id, nombre, configuracion FROM empresas WHERE nombre LIKE \'%Orillas del Coilaco%\'\n');

        const { rows } = await pool.query(
            "SELECT id, nombre, configuracion FROM empresas WHERE nombre LIKE $1",
            ['%Orillas del Coilaco%']
        );

        if (rows.length === 0) {
            console.log('❌ NO se encontró la empresa en la base de datos');
            return;
        }

        const empresa = rows[0];
        console.log(`✅ EMPRESA ENCONTRADA: ${empresa.nombre} (ID: ${empresa.id})`);

        // 2. MOSTRAR EL CONTENIDO COMPLETO DE configuracion
        console.log('\n📦 CONTENIDO COMPLETO DE LA COLUMNA "configuracion":');
        console.log(JSON.stringify(empresa.configuracion, null, 2));

        // 3. VERIFICACIÓN ESPECÍFICA DE websiteSettings
        console.log('\n🔍 VERIFICACIÓN ESPECÍFICA DE websiteSettings:');

        if (!empresa.configuracion || !empresa.configuracion.websiteSettings) {
            console.log('❌ websiteSettings NO EXISTE en configuracion');
            return;
        }

        const ws = empresa.configuracion.websiteSettings;

        // Campos CRÍTICOS que deberían estar
        console.log('\n✅ CAMPOS CRÍTICOS ENCONTRADOS:');
        console.log(`1. websiteSettings.subdomain: "${ws.subdomain || 'NO EXISTE'}"`);
        console.log(`2. websiteSettings.domain: "${ws.domain || 'NO EXISTE'}"`);
        console.log(`3. websiteSettings.general.subdomain: "${ws.general?.subdomain || 'NO EXISTE'}"`);
        console.log(`4. websiteSettings.theme.heroImageAlt: "${ws.theme?.heroImageAlt || 'NO EXISTE'}"`);
        console.log(`5. websiteSettings.theme.heroImageTitle: "${ws.theme?.heroImageTitle || 'NO EXISTE'}"`);
        console.log(`6. websiteSettings.theme.heroImageUrl: "${ws.theme?.heroImageUrl || 'NO EXISTE'}"`);

        // 4. VERIFICACIÓN PARA TENANT RESOLVER
        console.log('\n🔧 COMPATIBILIDAD CON TENANT RESOLVER:');
        const subdomainParaResolver = ws.subdomain || ws.general?.subdomain;
        console.log(`Subdominio que usará tenantResolver: "${subdomainParaResolver || 'NO DISPONIBLE'}"`);

        if (subdomainParaResolver) {
            console.log(`✅ TenantResolver podrá encontrar esta empresa con: ${subdomainParaResolver}.onrender.com`);
        } else {
            console.log('❌ TenantResolver NO podrá encontrar esta empresa (falta subdomain)');
        }

        // 5. CONSULTA ADICIONAL PARA VERIFICAR ESTRUCTURA
        console.log('\n📊 CONSULTA DE ESTRUCTURA INTERNA:');
        const { rows: estructuraRows } = await pool.query(
            `SELECT
                configuracion->'websiteSettings'->>'subdomain' as subdomain_root,
                configuracion->'websiteSettings'->'general'->>'subdomain' as subdomain_general,
                configuracion->'websiteSettings'->'theme'->>'heroImageAlt' as hero_alt,
                configuracion->'websiteSettings'->'theme'->>'heroImageTitle' as hero_title
             FROM empresas
             WHERE id = $1`,
            [empresa.id]
        );

        if (estructuraRows[0]) {
            const est = estructuraRows[0];
            console.log('✅ Consulta de estructura interna:');
            console.log(`   • subdomain (raíz): ${est.subdomain_root}`);
            console.log(`   • subdomain (general): ${est.subdomain_general}`);
            console.log(`   • heroImageAlt: ${est.hero_alt}`);
            console.log(`   • heroImageTitle: ${est.hero_title}`);
        }

        // 6. RESUMEN FINAL
        console.log('\n🎯 RESUMEN FINAL:');
        const tieneSubdomain = !!(ws.subdomain || ws.general?.subdomain);
        const tieneHeroMetadata = !!(ws.theme?.heroImageAlt && ws.theme?.heroImageTitle);

        if (tieneSubdomain && tieneHeroMetadata) {
            console.log('✅ ✅ ✅ TODOS LOS DATOS ESTÁN EN LA BASE DE DATOS ✅ ✅ ✅');
            console.log('   • Subdominio configurado: SÍ');
            console.log('   • Metadata de imagen hero: SÍ');
            console.log('   • Estructura correcta: SÍ');
        } else {
            console.log('⚠️  ALGUNOS DATOS FALTAN:');
            console.log(`   • Subdominio: ${tieneSubdomain ? 'SÍ' : 'NO'}`);
            console.log(`   • Metadata hero: ${tieneHeroMetadata ? 'SÍ' : 'NO'}`);
        }

    } catch (error) {
        console.error('❌ ERROR en la verificación:', error);
    } finally {
        await pool.end();
        console.log('\n🔚 VERIFICACIÓN COMPLETADA');
    }
}

// Ejecutar la confirmación
confirmarDatosBD().catch(console.error);