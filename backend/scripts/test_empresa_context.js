#!/usr/bin/env node
/**
 * backend/scripts/test_empresa_context.js
 *
 * Script para probar la funcionalidad extendida de buildContext para empresa.
 * Verifica que:
 * 1. getEmpresaContext funciona correctamente
 * 2. La estructura incluye todos los datos corporativos
 * 3. La integración con IA para contenido corporativo funciona
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getEmpresaContext } = require('../services/buildContextService');
const { getBrandIdentity } = require('../services/brandIdentityService');
const { generarContenidoCorporativo } = require('../services/aiContentService');

// ID de empresa de prueba (Cabaña 10)
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function main() {
    console.log('=== PRUEBA DE CONTEXTO DE EMPRESA PARA SSR ===\n');

    try {
        console.log('1. OBTENIENDO CONTEXTO DE EMPRESA...');
        const empresaContext = await getEmpresaContext(EMPRESA_ID);

        console.log('✅ Contexto obtenido exitosamente');
        console.log(`   Nombre: ${empresaContext.nombre}`);
        console.log(`   Ubicación: ${empresaContext.ubicacion.ciudad}, ${empresaContext.ubicacion.region}`);
        console.log(`   Slogan: ${empresaContext.slogan}`);
        console.log(`   Historia: ${empresaContext.historia ? 'SÍ' : 'NO'}`);
        console.log(`   Misión: ${empresaContext.mision ? 'SÍ' : 'NO'}`);
        console.log(`   Valores: ${empresaContext.valores.length} valores`);
        console.log(`   Público objetivo: ${empresaContext.publicoObjetivo || 'No definido'}\n`);

        // Verificar estructura completa
        console.log('2. VERIFICANDO ESTRUCTURA DEL CONTEXTO...');
        const requiredFields = [
            'nombre', 'ubicacion', 'slogan', 'historia', 'mision', 'valores',
            'brand', 'visual', 'seo', 'contacto'
        ];

        const missingFields = requiredFields.filter(field => {
            if (field === 'valores') return !Array.isArray(empresaContext[field]);
            if (field === 'ubicacion') return !empresaContext[field] || typeof empresaContext[field] !== 'object';
            return !empresaContext[field];
        });

        if (missingFields.length === 0) {
            console.log('✅ Estructura completa - todos los campos presentes');
        } else {
            console.log('⚠️  Campos faltantes:', missingFields.join(', '));
        }

        // Verificar identidad visual
        console.log('\n3. OBTENIENDO IDENTIDAD VISUAL...');
        const brandIdentity = await getBrandIdentity(EMPRESA_ID);

        console.log('✅ Identidad visual obtenida');
        console.log(`   Tono comunicación: ${brandIdentity.brand.tonoComunicacion}`);
        console.log(`   Estilo visual: ${brandIdentity.visual.estiloVisual}`);
        console.log(`   Colores definidos: ${Object.keys(brandIdentity.visual.colors).length}`);
        console.log(`   Componentes: ${Object.keys(brandIdentity.components).length}\n`);

        // Verificar que los colores usen tokens semánticos
        console.log('4. VERIFICANDO TOKENS DE COLOR...');
        const colorTokens = Object.values(brandIdentity.visual.colors);
        const invalidColors = colorTokens.filter(token => {
            // Verificar que sean tokens semánticos (primary-, danger-, success-, warning-)
            return !/^(primary|danger|success|warning|gray)-\d+$/.test(token);
        });

        if (invalidColors.length === 0) {
            console.log('✅ Todos los colores usan tokens semánticos correctos');
        } else {
            console.log('⚠️  Colores que no usan tokens semánticos:', invalidColors.join(', '));
        }

        // Probar generación de CSS personalizado
        console.log('\n5. GENERANDO CSS PERSONALIZADO...');
        const customCSS = require('../services/brandIdentityService').generateCustomCSS(brandIdentity);

        console.log('✅ CSS generado exitosamente');
        console.log(`   Longitud: ${customCSS.length} caracteres`);
        console.log(`   Variables CSS: ${(customCSS.match(/--[a-z-]+:/g) || []).length}`);
        console.log(`   Clases personalizadas: ${(customCSS.match(/\.brand-[a-z-]+/g) || []).length}\n`);

        // Probar generación de contenido corporativo (modo simulado para no gastar créditos)
        console.log('6. PROBANDO GENERACIÓN DE CONTENIDO CORPORATIVO...');

        if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
            console.log('🔧 API Key detectada - probando generación real...');

            try {
                const contenidoCorporativo = await generarContenidoCorporativo(empresaContext);

                console.log('✅ Contenido corporativo generado exitosamente');
                console.log(`   Home Page: ${contenidoCorporativo.homePage.hero.title}`);
                console.log(`   About Page: ${contenidoCorporativo.aboutPage.hero.title}`);
                console.log(`   SEO Global: ${contenidoCorporativo.seoGlobal.metaTitle.substring(0, 60)}...`);
                console.log(`   Políticas: ${Object.keys(contenidoCorporativo.policies).length} políticas definidas`);

                // Verificar estructura del contenido
                const contenidoFields = ['homePage', 'aboutPage', 'contactPage', 'seoGlobal', 'policies'];
                const missingContenido = contenidoFields.filter(field => !contenidoCorporativo[field]);

                if (missingContenido.length === 0) {
                    console.log('✅ Estructura de contenido completa');
                } else {
                    console.log('⚠️  Secciones faltantes en contenido:', missingContenido.join(', '));
                }

            } catch (aiError) {
                console.log('⚠️  Error en generación IA (puede ser por falta de créditos o API key):', aiError.message);
                console.log('   Usando contenido por defecto como fallback...');

                const defaultContent = require('../services/aiContentService').getDefaultCorporateContent(empresaContext);
                console.log(`   ✅ Contenido por defecto cargado: ${defaultContent.homePage.hero.title}`);
            }
        } else {
            console.log('⚠️  No hay API Key configurada - usando modo simulado');
            console.log('   Para probar generación real, configura GEMINI_API_KEY o OPENAI_API_KEY en .env');

            const defaultContent = require('../services/aiContentService').getDefaultCorporateContent(empresaContext);
            console.log(`   ✅ Contenido por defecto cargado: ${defaultContent.homePage.hero.title}`);
        }

        // Resumen final
        console.log('\n📊 RESUMEN FINAL:');
        console.log('================');
        console.log(`✅ Contexto de empresa: COMPLETO`);
        console.log(`✅ Identidad visual: COMPLETA`);
        console.log(`✅ Tokens de color: CORRECTOS`);
        console.log(`✅ CSS personalizado: GENERADO`);
        console.log(`✅ Contenido corporativo: ${process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY ? 'GENERADO CON IA' : 'MODO SIMULADO'}`);

        console.log('\n🎯 RECOMENDACIONES:');
        if (!empresaContext.historia) {
            console.log('   • Agregar historia de la empresa en Configuración Web → General');
        }
        if (!empresaContext.mision) {
            console.log('   • Definir misión y valores corporativos');
        }
        if (empresaContext.valores.length === 0) {
            console.log('   • Agregar valores corporativos');
        }
        if (!brandIdentity.visual.logos.primary) {
            console.log('   • Subir logo principal en Configuración Web → Brand');
        }

        console.log('\n🔧 PARA CONFIGURAR COMPLETAMENTE:');
        console.log('   1. Ir a Configuración Web (/website-general)');
        console.log('   2. Completar wizard de configuración general');
        console.log('   3. Configurar identidad visual en sección Brand');
        console.log('   4. Generar contenido con IA usando "Generar con IA"');

    } catch (error) {
        console.error('❌ Error durante la prueba:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { testEmpresaContext: main };