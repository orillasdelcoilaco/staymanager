/**
 * backend/scripts/test_ia_context_debug.js
 *
 * Script para DEBUG: Verificar EXACTAMENTE qué datos recibe la IA
 * y qué contenido genera.
 */

const { getSSROptimizedData } = require('../services/buildContextService');
const { generarContenidoCorporativo } = require('../services/ai/corporateContent');

async function debugIAContext() {
    console.log('=== DEBUG: ¿QUÉ DATOS RECIBE LA IA? ===\n');

    // Usar una empresa de prueba (cambiar por ID real)
    const empresaId = 'test-empresa-id'; // CAMBIAR POR ID REAL

    try {
        console.log('1. OBTENIENDO DATOS COMPLETOS DE LA EMPRESA...');
        const ssrData = await getSSROptimizedData(empresaId);

        console.log('\n2. DATOS QUE RECIBE EL SISTEMA SSR:');
        console.log('========================================');
        console.log(JSON.stringify(ssrData, null, 2));
        console.log('========================================\n');

        console.log('3. EXTRACCIÓN DE DATOS RELEVANTES PARA IA:');
        console.log('----------------------------------------');
        console.log(`• Nombre: ${ssrData.nombre}`);
        console.log(`• Slogan: ${ssrData.slogan}`);
        console.log(`• Historia: ${ssrData.historia?.substring(0, 100)}...`);
        console.log(`• Misión: ${ssrData.mision}`);
        console.log(`• Valores: ${ssrData.valores?.join(', ')}`);
        console.log(`• Ubicación: ${ssrData.ubicacion?.ciudad}, ${ssrData.ubicacion?.region}`);
        console.log(`• Propuesta de valor: ${ssrData.brand?.propuestaValor}`);
        console.log(`• Tono comunicación: ${ssrData.brand?.tonoComunicacion}`);
        console.log(`• Teléfono: ${ssrData.contacto?.telefonoPrincipal}`);
        console.log(`• Email: ${ssrData.contacto?.emailContacto}`);
        console.log('----------------------------------------\n');

        console.log('4. ¿ES SUFICIENTE CONTEXTO PARA IA?');
        console.log('----------------------------------------');

        const tieneSuficienteContexto = (
            ssrData.nombre &&
            ssrData.ubicacion?.ciudad &&
            ssrData.brand?.propuestaValor
        );

        if (tieneSuficienteContexto) {
            console.log('✅ CONTEXTO SUFICIENTE: La IA tiene datos clave');
            console.log('   - Nombre de empresa: ✓');
            console.log('   - Ubicación: ✓');
            console.log('   - Propuesta de valor: ✓');
        } else {
            console.log('⚠️  CONTEXTO INSUFICIENTE: Faltan datos clave');
            if (!ssrData.nombre) console.log('   - Nombre de empresa: ✗');
            if (!ssrData.ubicacion?.ciudad) console.log('   - Ubicación: ✗');
            if (!ssrData.brand?.propuestaValor) console.log('   - Propuesta de valor: ✗');
        }

        console.log('\n5. GENERANDO CONTENIDO CON IA...');
        console.log('----------------------------------------');

        try {
            const contenidoIA = await generarContenidoCorporativo(ssrData);

            console.log('✅ CONTENIDO GENERADO POR IA:');
            console.log('========================================');
            console.log(JSON.stringify(contenidoIA, null, 2));
            console.log('========================================\n');

            console.log('6. ANÁLISIS DEL CONTENIDO GENERADO:');
            console.log('----------------------------------------');

            if (contenidoIA.homePage) {
                console.log('📄 PÁGINA DE INICIO:');
                console.log(`   • Título: ${contenidoIA.homePage.hero?.title}`);
                console.log(`   • Subtítulo: ${contenidoIA.homePage.hero?.subtitle}`);
                console.log(`   • CTA: ${contenidoIA.homePage.hero?.ctaText}`);
                console.log(`   • Propuesta de valor: ${contenidoIA.homePage.valueProposition?.title}`);
            }

            if (contenidoIA.seo) {
                console.log('\n🔍 SEO GENERADO:');
                console.log(`   • Meta title: ${contenidoIA.seo.metaTitle}`);
                console.log(`   • Meta description: ${contenidoIA.seo.metaDescription}`);
            }

            console.log('\n7. ¿EL CONTENIDO ESTÁ ORIENTADO A VENTAS?');
            console.log('----------------------------------------');

            const contenidoVentas = analizarOrientacionVentas(contenidoIA);
            console.log(contenidoVentas);

        } catch (iaError) {
            console.log(`❌ ERROR GENERANDO CONTENIDO IA: ${iaError.message}`);
            console.log('   Esto puede ser porque:');
            console.log('   1. No hay configuración de IA');
            console.log('   2. API key no configurada');
            console.log('   3. Empresa no tiene datos suficientes');
        }

    } catch (error) {
        console.log(`❌ ERROR OBTENIENDO DATOS: ${error.message}`);
        console.log('   Posibles causas:');
        console.log('   1. Empresa ID no existe');
        console.log('   2. Base de datos no disponible');
        console.log('   3. Error en la query');
    }

    console.log('\n=== RECOMENDACIONES ===');
    console.log('1. Verificar que la empresa tenga datos completos en:');
    console.log('   - Panel admin → Configuración → Website');
    console.log('   - Panel admin → Empresa → Datos básicos');
    console.log('\n2. Para probar con una empresa real:');
    console.log('   node backend/scripts/test_ia_context_debug.js --empresa-id=ID_REAL');
}

function analizarOrientacionVentas(contenidoIA) {
    const textoCompleto = JSON.stringify(contenidoIA).toLowerCase();

    const palabrasVenta = [
        'reserva', 'reservar', 'book', 'booking', 'disponible',
        'oferta', 'especial', 'promoción', 'descuento', 'precio',
        'ahora', 'inmediato', 'rápido', 'fácil', 'simple',
        'exclusivo', 'limitado', 'última', 'oportunidad',
        'garantía', 'seguro', 'confianza', 'calidad',
        'mejor', 'único', 'especial', 'premium', 'lujo'
    ];

    const palabrasSEO = [
        'mejor', 'top', 'guía', 'completo', 'definitivo',
        'cómo', 'consejos', 'tips', 'recomendaciones',
        'barato', 'económico', 'calidad-precio', 'valor'
    ];

    let ventasCount = 0;
    let seoCount = 0;

    palabrasVenta.forEach(palabra => {
        if (textoCompleto.includes(palabra)) ventasCount++;
    });

    palabrasSEO.forEach(palabra => {
        if (textoCompleto.includes(palabra)) seoCount++;
    });

    const totalPalabras = palabrasVenta.length + palabrasSEO.length;
    const scoreVentas = (ventasCount / palabrasVenta.length) * 100;
    const scoreSEO = (seoCount / palabrasSEO.length) * 100;

    let resultado = '';

    if (scoreVentas > 50) {
        resultado += `✅ FUERTE ORIENTACIÓN A VENTAS (${scoreVentas.toFixed(1)}%)\n`;
        resultado += `   • Palabras de venta encontradas: ${ventasCount}/${palabrasVenta.length}\n`;
    } else {
        resultado += `⚠️  DÉBIL ORIENTACIÓN A VENTAS (${scoreVentas.toFixed(1)}%)\n`;
        resultado += `   • Palabras de venta encontradas: ${ventasCount}/${palabrasVenta.length}\n`;
    }

    if (scoreSEO > 50) {
        resultado += `✅ BUEN SEO (${scoreSEO.toFixed(1)}%)\n`;
        resultado += `   • Palabras SEO encontradas: ${seoCount}/${palabrasSEO.length}\n`;
    } else {
        resultado += `⚠️  SEO MEJORABLE (${scoreSEO.toFixed(1)}%)\n`;
        resultado += `   • Palabras SEO encontradas: ${seoCount}/${palabrasSEO.length}\n`;
    }

    // Ejemplos de contenido encontrado
    const ejemplos = [];
    palabrasVenta.forEach(palabra => {
        if (textoCompleto.includes(palabra)) {
            // Buscar contexto alrededor de la palabra
            const index = textoCompleto.indexOf(palabra);
            const contexto = textoCompleto.substring(Math.max(0, index - 30), Math.min(textoCompleto.length, index + 30));
            ejemplos.push(`   - "${contexto.replace(palabra, `**${palabra}**`)}"`);
        }
    });

    if (ejemplos.length > 0) {
        resultado += '\n📝 EJEMPLOS DE CONTENIDO DE VENTAS:\n';
        resultado += ejemplos.slice(0, 3).join('\n');
    }

    return resultado;
}

// Manejar argumentos de línea de comandos
const args = process.argv.slice(2);
let empresaIdArg = 'test-empresa-id';

args.forEach(arg => {
    if (arg.startsWith('--empresa-id=')) {
        empresaIdArg = arg.split('=')[1];
    }
});

// Reemplazar con el ID real si se proporciona
if (empresaIdArg !== 'test-empresa-id') {
    // Aquí necesitaríamos obtener un ID real de la base de datos
    // Por ahora, usaremos el argumento directamente
    console.log(`Usando empresa ID: ${empresaIdArg}`);
    debugIAContext().catch(console.error);
} else {
    console.log('⚠️  Usando empresa ID de prueba.');
    console.log('   Para probar con empresa real:');
    console.log('   node backend/scripts/test_ia_context_debug.js --empresa-id=ID_REAL\n');
    debugIAContext().catch(console.error);
}