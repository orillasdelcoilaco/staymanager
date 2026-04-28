// Script de prueba para verificar guardado de configuración web
const { Pool } = require('pg');
require('dotenv').config();

async function testGuardadoConfig() {
    console.log('=== PRUEBA DE GUARDADO DE CONFIGURACIÓN WEB ===\n');

    // Configurar pool de PostgreSQL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // 1. Obtener una empresa de prueba (la primera en la base de datos)
        const { rows: empresas } = await pool.query('SELECT id, nombre FROM empresas LIMIT 1');

        if (empresas.length === 0) {
            console.error('❌ No hay empresas en la base de datos');
            return;
        }

        const empresaId = empresas[0].id;
        const empresaNombre = empresas[0].nombre;
        console.log(`📋 Empresa de prueba: ${empresaNombre} (ID: ${empresaId})`);

        // 2. Verificar datos actuales ANTES del guardado
        console.log('\n📊 DATOS ACTUALES EN BASE DE DATOS:');
        const { rows: empresaActual } = await pool.query(
            'SELECT id, nombre, subdominio, dominio, configuracion FROM empresas WHERE id = $1',
            [empresaId]
        );

        if (empresaActual[0]) {
            const empresa = empresaActual[0];
            console.log(`- ID: ${empresa.id}`);
            console.log(`- Nombre: ${empresa.nombre}`);
            console.log(`- Subdominio (columna): ${empresa.subdominio || 'NULL'}`);
            console.log(`- Dominio (columna): ${empresa.dominio || 'NULL'}`);

            if (empresa.configuracion) {
                console.log('- Configuración (JSON):');
                console.log(JSON.stringify(empresa.configuracion, null, 2));

                if (empresa.configuracion.websiteSettings) {
                    console.log('\n  📁 websiteSettings:');
                    console.log(JSON.stringify(empresa.configuracion.websiteSettings, null, 2));

                    if (empresa.configuracion.websiteSettings.theme) {
                        console.log('\n    🎨 theme:');
                        console.log(JSON.stringify(empresa.configuracion.websiteSettings.theme, null, 2));
                    }
                }
            } else {
                console.log('- Configuración: NULL o vacío');
            }
        }

        // 3. Simular el payload que envía el frontend
        const payloadSimulado = {
            general: {
                whatsapp: '+56912345678',
                googleMapsUrl: 'https://maps.google.com/...',
                domain: 'prueba-test.onrender.com',
                gaTrackingId: 'G-TEST123',
                wizardCompleted: true,
                subdomain: 'prueba-test'  // ¡IMPORTANTE! Esto es lo que debería guardarse
            },
            theme: {
                logoUrl: 'https://storage.googleapis.com/.../logo.webp',
                heroImageUrl: 'https://storage.googleapis.com/.../hero.webp',
                heroImageAlt: 'Texto alternativo de prueba',
                heroImageTitle: 'Título de imagen de prueba',
                primaryColor: '#3b82f6',
                secondaryColor: '#6b7280',
                accentColor: '#10b981'
            },
            content: {
                homeH1: 'Título de prueba H1',
                homeIntro: 'Introducción de prueba para el sitio web'
            },
            seo: {
                title: 'Meta título de prueba',
                description: 'Meta descripción de prueba',
                keywords: 'prueba, test, alojamiento'
            }
        };

        console.log('\n📤 PAYLOAD SIMULADO (lo que envía el frontend):');
        console.log(JSON.stringify(payloadSimulado, null, 2));

        // 4. Simular lo que hace actualizarDetallesEmpresa
        console.log('\n🔄 SIMULANDO actualizarDetallesEmpresa...');

        // Construir websiteSettings como lo hace websiteConfigRoutes.js
        const websiteSettings = {};

        if (payloadSimulado.general) {
            websiteSettings.general = payloadSimulado.general;
            // También guardar subdomain y domain en el nivel raíz de websiteSettings para tenantResolver
            if (payloadSimulado.general.subdomain) websiteSettings.subdomain = payloadSimulado.general.subdomain;
            if (payloadSimulado.general.domain) websiteSettings.domain = payloadSimulado.general.domain;
        }
        if (payloadSimulado.theme) {
            websiteSettings.theme = {
                primaryColor: payloadSimulado.theme.primaryColor,
                secondaryColor: payloadSimulado.theme.secondaryColor,
                logoUrl: payloadSimulado.theme.logoUrl || ''
            };
            // Hero image fields
            if (payloadSimulado.theme.heroImageUrl) websiteSettings.theme.heroImageUrl = payloadSimulado.theme.heroImageUrl;
            if (payloadSimulado.theme.heroImageAlt) websiteSettings.theme.heroImageAlt = payloadSimulado.theme.heroImageAlt;
            if (payloadSimulado.theme.heroImageTitle) websiteSettings.theme.heroImageTitle = payloadSimulado.theme.heroImageTitle;
        }
        if (payloadSimulado.content) websiteSettings.content = payloadSimulado.content;
        if (payloadSimulado.seo) websiteSettings.seo = payloadSimulado.seo;

        console.log('\n📝 websiteSettings construido:');
        console.log(JSON.stringify(websiteSettings, null, 2));

        // 5. Ejecutar el UPDATE como lo hace actualizarDetallesEmpresa
        const resto = { websiteSettings };

        await pool.query(`
            UPDATE empresas SET
                configuracion = configuracion || $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
        `, [
            empresaId,
            JSON.stringify(resto)
        ]);

        console.log('\n✅ UPDATE ejecutado en base de datos');

        // 6. Verificar datos DESPUÉS del guardado
        console.log('\n📊 DATOS DESPUÉS DEL GUARDADO:');
        const { rows: empresaDespues } = await pool.query(
            'SELECT id, nombre, subdominio, dominio, configuracion FROM empresas WHERE id = $1',
            [empresaId]
        );

        if (empresaDespues[0]) {
            const empresa = empresaDespues[0];

            console.log(`- Subdominio (columna): ${empresa.subdominio || 'NULL'}`);
            console.log(`- Dominio (columna): ${empresa.dominio || 'NULL'}`);

            if (empresa.configuracion) {
                console.log('- Configuración (JSON):');
                console.log(JSON.stringify(empresa.configuracion, null, 2));

                // Verificar específicamente los campos que deberían estar
                if (empresa.configuracion.websiteSettings) {
                    const ws = empresa.configuracion.websiteSettings;

                    console.log('\n🔍 VERIFICACIÓN DE CAMPOS:');
                    console.log(`✓ websiteSettings.subdomain: ${ws.subdomain || 'NO EXISTE'}`);
                    console.log(`✓ websiteSettings.domain: ${ws.domain || 'NO EXISTE'}`);
                    console.log(`✓ websiteSettings.general.subdomain: ${ws.general?.subdomain || 'NO EXISTE'}`);
                    console.log(`✓ websiteSettings.theme.heroImageAlt: ${ws.theme?.heroImageAlt || 'NO EXISTE'}`);
                    console.log(`✓ websiteSettings.theme.heroImageTitle: ${ws.theme?.heroImageTitle || 'NO EXISTE'}`);

                    // Verificar tenantResolver
                    console.log('\n🔍 COMPATIBILIDAD CON TENANT RESOLVER:');
                    const subdomainParaResolver = ws.subdomain || ws.general?.subdomain;
                    console.log(`Subdominio para tenantResolver: ${subdomainParaResolver || 'NO DISPONIBLE'}`);
                }
            }
        }

        // 7. Probar la función obtenerDetallesEmpresa
        console.log('\n🧪 PROBANDO obtenerDetallesEmpresa:');
        const { rows: empresaMapeada } = await pool.query('SELECT * FROM empresas WHERE id = $1', [empresaId]);

        if (empresaMapeada[0]) {
            // Simular mapearEmpresa
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

            const empresaResultado = mapearEmpresa(empresaMapeada[0]);
            console.log('Resultado de mapearEmpresa:');
            console.log(`- Tiene websiteSettings: ${!!empresaResultado.websiteSettings}`);
            console.log(`- websiteSettings.theme.heroImageAlt: ${empresaResultado.websiteSettings?.theme?.heroImageAlt || 'NO EXISTE'}`);
            console.log(`- websiteSettings.theme.heroImageTitle: ${empresaResultado.websiteSettings?.theme?.heroImageTitle || 'NO EXISTE'}`);
        }

    } catch (error) {
        console.error('❌ ERROR en la prueba:', error);
    } finally {
        await pool.end();
        console.log('\n=== PRUEBA FINALIZADA ===');
    }
}

// Ejecutar la prueba
testGuardadoConfig().catch(console.error);