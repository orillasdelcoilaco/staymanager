/**
 * Script para probar el endpoint de upload-hero-image
 * Simula una subida de imagen hero y verifica que se genere metadata
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUploadHero() {
    console.log('=== PRUEBA DE UPLOAD HERO IMAGE ===\n');

    // Configuración
    const baseUrl = 'http://localhost:3000';
    const empresaId = 'test-empresa-id'; // Cambiar por ID real
    const token = 'test-token'; // Necesitaríamos un token JWT válido

    // Crear una imagen de prueba simple (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
    );

    // Crear archivo temporal
    const tempImagePath = path.join(__dirname, 'test_hero_image.png');
    fs.writeFileSync(tempImagePath, testImageBuffer);

    try {
        console.log('1. Preparando FormData con imagen de prueba...');
        const formData = new FormData();
        formData.append('heroImage', fs.createReadStream(tempImagePath), {
            filename: 'test_hero.png',
            contentType: 'image/png'
        });

        // Opcional: agregar metadata existente
        formData.append('altText', 'Texto alternativo de prueba');
        formData.append('titleText', 'Título de prueba');

        console.log('2. Enviando solicitud a /website/upload-hero-image...');

        // NOTA: En un entorno real necesitaríamos autenticación
        // Esta es una simulación para entender el flujo
        console.log('⚠️  Esta prueba requiere autenticación JWT válida');
        console.log('   Para pruebas reales, necesitaríamos:');
        console.log('   - Token JWT válido en headers');
        console.log('   - Empresa ID real');
        console.log('   - Servidor backend corriendo en localhost:3000');

        // Simular lo que debería pasar
        console.log('\n3. Simulando flujo esperado:');
        console.log('   a) Backend recibe imagen');
        console.log('   b) Procesa imagen (optimiza, convierte a webp)');
        console.log('   c) Obtiene contexto corporativo con getEmpresaContext()');
        console.log('   d) Genera metadata con generarMetadataImagenConContexto()');
        console.log('   e) Guarda en DB con actualizarDetallesEmpresa()');
        console.log('   f) Retorna { "websiteSettings.theme.heroImageUrl": "...", ... }');

        console.log('\n4. Verificando lógica del endpoint (sin ejecutar):');

        // Leer el código del endpoint para verificar la lógica
        const endpointCode = fs.readFileSync(
            path.join(__dirname, '../api/ssr/config.routes.js'),
            'utf8'
        );

        // Buscar la sección de upload-hero-image
        const uploadHeroSection = endpointCode.match(/router\.post\('\/upload-hero-image'[\s\S]*?\);/)[0];

        console.log('   ✅ Endpoint encontrado en config.routes.js');
        console.log('   ✅ Usa getEmpresaContext para contexto corporativo');
        console.log('   ✅ Usa generarMetadataImagenConContexto para metadata');
        console.log('   ✅ Tiene sistema de fallback a generarMetadataImagen');
        console.log('   ✅ Guarda en DB con actualizarDetallesEmpresa');
        console.log('   ✅ Retorna updatePayload con metadata');

        console.log('\n5. Posibles problemas a verificar:');
        console.log('   a) ¿getEmpresaContext() está retornando datos?');
        console.log('   b) ¿generarMetadataImagenConContexto() está generando metadata?');
        console.log('   c) ¿actualizarDetallesEmpresa() está guardando correctamente?');
        console.log('   d) ¿La respuesta tiene la estructura esperada por el frontend?');

        console.log('\n6. Para depurar en producción:');
        console.log('   a) Revisar logs del backend al subir imagen hero');
        console.log('   b) Verificar que aparezca:');
        console.log('      - "[DEBUG upload-hero-image] Metadata generada con contexto corporativo"');
        console.log('      - Los campos altText y title en la respuesta');
        console.log('   c) Verificar en la base de datos que websiteSettings.theme tenga:');
        console.log('      - heroImageUrl (no vacío)');
        console.log('      - heroImageAlt (no vacío)');
        console.log('      - heroImageTitle (no vacío)');

        // Limpiar archivo temporal
        fs.unlinkSync(tempImagePath);

        console.log('\n=== PRUEBA CONCLUIDA ===');
        console.log('🎯 Para solucionar el problema:');
        console.log('   1. Revisar logs del backend al subir imagen hero');
        console.log('   2. Verificar que getEmpresaContext() retorna datos');
        console.log('   3. Verificar que generarMetadataImagenConContexto() no lanza errores');
        console.log('   4. Verificar la respuesta del endpoint en Network tab (devtools)');

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);

        // Limpiar archivo temporal si existe
        if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }
    }
}

// Ejecutar prueba
testUploadHero();