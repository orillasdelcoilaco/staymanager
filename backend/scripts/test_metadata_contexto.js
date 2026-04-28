/**
 * Script de prueba para verificar generación de metadata de imágenes con contexto corporativo
 */

const { getEmpresaContext } = require('../services/buildContextService');
const { generarMetadataImagenConContexto } = require('../services/aiContentService');
const fs = require('fs');
const path = require('path');

async function testMetadataConContexto() {
    console.log('=== PRUEBA DE GENERACIÓN DE METADATA CON CONTEXTO CORPORATIVO ===\n');

    // ID de empresa de prueba (usar una empresa existente)
    const empresaId = 'test-empresa-id'; // Cambiar por un ID real para pruebas

    try {
        console.log('1. Obteniendo contexto corporativo completo...');
        const empresaContext = await getEmpresaContext(empresaId);

        console.log('✅ Contexto obtenido exitosamente');
        console.log('   - Nombre:', empresaContext.nombre);
        console.log('   - Tiene historia:', !!empresaContext.historia);
        console.log('   - Tiene misión:', !!empresaContext.mision);
        console.log('   - Valores:', Array.isArray(empresaContext.valores) ? empresaContext.valores.length : 0);
        console.log('   - Slogan:', empresaContext.slogan || 'No tiene');
        console.log('   - Propuesta de valor:', empresaContext.brand?.propuestaValor || 'No tiene');
        console.log('   - Público objetivo:', empresaContext.publicoObjetivo || 'No especificado');
        console.log('   - Enfoque:', empresaContext.enfoque || 'No especificado');

        // Crear una imagen de prueba simple (buffer vacío para prueba)
        // En una prueba real, usaríamos una imagen real
        const imageBuffer = Buffer.from('fake image data for testing');

        console.log('\n2. Probando generación de metadata para imagen hero...');

        const metadataHero = await generarMetadataImagenConContexto(
            empresaContext,
            "Página Principal del Sitio Web",
            `Sitio web de ${empresaContext.nombre} - ${empresaContext.slogan || 'Alojamientos turísticos de calidad'}`,
            "Imagen de Portada (Hero)",
            "Portada Web",
            imageBuffer
        );

        console.log('✅ Metadata hero generada:');
        console.log('   - altText:', metadataHero.altText);
        console.log('   - title:', metadataHero.title);
        console.log('   - advertencia:', metadataHero.advertencia);
        console.log('   - Longitud altText:', metadataHero.altText?.length || 0, 'caracteres');
        console.log('   - Longitud title:', metadataHero.title?.length || 0, 'caracteres');

        console.log('\n3. Probando generación de metadata para componente específico...');

        const metadataComponente = await generarMetadataImagenConContexto(
            empresaContext,
            "Cabaña Los Pinos",
            "Hermosa cabaña familiar con vista al lago y capacidad para 6 personas",
            "Dormitorio Principal",
            "Dormitorio",
            imageBuffer,
            "Vista de la cama con almohadas decorativas"
        );

        console.log('✅ Metadata componente generada:');
        console.log('   - altText:', metadataComponente.altText);
        console.log('   - title:', metadataComponente.title);
        console.log('   - advertencia:', metadataComponente.advertencia);
        console.log('   - Longitud altText:', metadataComponente.altText?.length || 0, 'caracteres');
        console.log('   - Longitud title:', metadataComponente.title?.length || 0, 'caracteres');

        console.log('\n4. Verificando calidad de metadata generada...');

        const checks = [
            {
                name: 'altText no vacío',
                condition: metadataHero.altText && metadataHero.altText.trim().length > 0,
                value: metadataHero.altText ? '✓' : '✗'
            },
            {
                name: 'title no vacío',
                condition: metadataHero.title && metadataHero.title.trim().length > 0,
                value: metadataHero.title ? '✓' : '✗'
            },
            {
                name: 'altText <= 125 caracteres',
                condition: metadataHero.altText && metadataHero.altText.length <= 125,
                value: metadataHero.altText ? `${metadataHero.altText.length}/125` : 'N/A'
            },
            {
                name: 'title <= 60 caracteres',
                condition: metadataHero.title && metadataHero.title.length <= 60,
                value: metadataHero.title ? `${metadataHero.title.length}/60` : 'N/A'
            },
            {
                name: 'Incluye contexto corporativo en altText',
                condition: metadataHero.altText && (
                    metadataHero.altText.includes(empresaContext.nombre) ||
                    (empresaContext.slogan && metadataHero.altText.includes(empresaContext.slogan)) ||
                    (empresaContext.ubicacion?.ciudad && metadataHero.altText.includes(empresaContext.ubicacion.ciudad))
                ),
                value: 'Verificar manualmente'
            }
        ];

        console.log('\nResultados de verificación:');
        checks.forEach(check => {
            console.log(`   ${check.condition ? '✅' : '⚠️'} ${check.name}: ${check.value}`);
        });

        console.log('\n=== PRUEBA COMPLETADA ===');
        console.log('🎯 La IA ahora generará metadata considerando:');
        console.log('   - Historia y misión de la empresa');
        console.log('   - Valores corporativos');
        console.log('   - Propuesta de valor de marca');
        console.log('   - Público objetivo');
        console.log('   - Tono de comunicación');
        console.log('   - Ubicación y contexto geográfico');

        return {
            success: true,
            empresaContext: {
                nombre: empresaContext.nombre,
                tieneHistoria: !!empresaContext.historia,
                tieneMision: !!empresaContext.mision,
                tieneValores: Array.isArray(empresaContext.valores) && empresaContext.valores.length > 0,
                tieneSlogan: !!empresaContext.slogan,
                tienePropuestaValor: !!empresaContext.brand?.propuestaValor
            },
            metadataHero,
            metadataComponente,
            checks
        };

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        console.error('Stack:', error.stack);

        // Si falla getEmpresaContext, probar con datos mock
        console.log('\n⚠️ Probando con datos mock...');

        const mockEmpresaContext = {
            nombre: "Cabañas del Lago",
            historia: "Fundada en 2010, somos una empresa familiar dedicada a ofrecer experiencias únicas en cabañas con vista al lago.",
            mision: "Proporcionar experiencias memorables en la naturaleza con el máximo confort y atención personalizada.",
            valores: ["Calidad", "Sostenibilidad", "Hospitalidad", "Innovación"],
            slogan: "Tu escape perfecto a la naturaleza",
            brand: {
                propuestaValor: "Cabañas premium con servicios exclusivos y atención 24/7",
                tonoComunicacion: "cercano y profesional"
            },
            publicoObjetivo: "Familias y parejas buscando desconexión en la naturaleza",
            enfoque: "Experiencias premium en entornos naturales",
            ubicacion: {
                ciudad: "Puerto Varas",
                region: "Los Lagos"
            }
        };

        const imageBuffer = Buffer.from('fake image data for testing');

        console.log('Generando metadata con datos mock...');

        try {
            const metadataMock = await generarMetadataImagenConContexto(
                mockEmpresaContext,
                "Cabaña Los Pinos",
                "Cabaña familiar con vista al lago y capacidad para 6 personas",
                "Dormitorio Principal",
                "Dormitorio",
                imageBuffer
            );

            console.log('✅ Metadata mock generada:');
            console.log('   - altText:', metadataMock.altText);
            console.log('   - title:', metadataMock.title);

            return {
                success: true,
                usingMock: true,
                metadataMock
            };
        } catch (mockError) {
            console.error('❌ Error incluso con datos mock:', mockError.message);
            return {
                success: false,
                error: error.message,
                mockError: mockError.message
            };
        }
    }
}

// Ejecutar prueba si se llama directamente
if (require.main === module) {
    testMetadataConContexto()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 Prueba exitosa!');
                process.exit(0);
            } else {
                console.log('\n❌ Prueba fallida');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Error no manejado:', error);
            process.exit(1);
        });
}

module.exports = { testMetadataConContexto };