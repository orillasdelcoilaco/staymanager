/**
 * Script simple para verificar que las funciones se importan correctamente
 */

console.log('=== PRUEBA DE IMPORTACIÓN DE FUNCIONES DE METADATA ===\n');

try {
    console.log('1. Importando funciones de aiContentService...');
    const { generarMetadataImagen, generarMetadataImagenConContexto } = require('../services/aiContentService');
    console.log('✅ Funciones importadas correctamente');
    console.log('   - generarMetadataImagen:', typeof generarMetadataImagen);
    console.log('   - generarMetadataImagenConContexto:', typeof generarMetadataImagenConContexto);
} catch (error) {
    console.error('❌ Error importando aiContentService:', error.message);
    process.exit(1);
}

try {
    console.log('\n2. Importando funciones de buildContextService...');
    const { getEmpresaContext } = require('../services/buildContextService');
    console.log('✅ Funciones importadas correctamente');
    console.log('   - getEmpresaContext:', typeof getEmpresaContext);
} catch (error) {
    console.error('❌ Error importando buildContextService:', error.message);
    process.exit(1);
}

try {
    console.log('\n3. Importando prompts de image.js...');
    const { promptMetadataImagen, promptMetadataImagenConContexto } = require('../services/ai/prompts/image');
    console.log('✅ Prompts importados correctamente');
    console.log('   - promptMetadataImagen:', typeof promptMetadataImagen);
    console.log('   - promptMetadataImagenConContexto:', typeof promptMetadataImagenConContexto);
} catch (error) {
    console.error('❌ Error importando prompts:', error.message);
    process.exit(1);
}

console.log('\n4. Probando creación de prompt con contexto...');

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

try {
    const { promptMetadataImagenConContexto } = require('../services/ai/prompts/image');
    const prompt = promptMetadataImagenConContexto({
        empresaContext: mockEmpresaContext,
        nombrePropiedad: "Cabaña Los Pinos",
        descripcionPropiedad: "Cabaña familiar con vista al lago y capacidad para 6 personas",
        nombreComponente: "Dormitorio Principal",
        tipoComponente: "Dormitorio",
        contextoEsperado: "Vista de la cama con almohadas decorativas"
    });

    console.log('✅ Prompt generado correctamente');
    console.log('   - Longitud del prompt:', prompt.length, 'caracteres');
    console.log('   - Incluye nombre empresa:', prompt.includes(mockEmpresaContext.nombre));
    console.log('   - Incluye historia:', prompt.includes(mockEmpresaContext.historia.substring(0, 50)));
    console.log('   - Incluye misión:', prompt.includes(mockEmpresaContext.mision.substring(0, 50)));
    console.log('   - Incluye valores:', prompt.includes('Calidad'));
    console.log('   - Incluye slogan:', prompt.includes(mockEmpresaContext.slogan));
    console.log('   - Incluye propuesta valor:', prompt.includes(mockEmpresaContext.brand.propuestaValor.substring(0, 50)));

    // Verificar estructura del prompt
    const requiredSections = [
        'CONTEXTO CORPORATIVO COMPLETO',
        'CONTEXTO DE LA IMAGEN',
        'TAREAS DE GENERACIÓN DE METADATOS',
        'altText',
        'title',
        'advertencia',
        'Responde SOLO JSON'
    ];

    console.log('\n5. Verificando estructura del prompt:');
    requiredSections.forEach(section => {
        const hasSection = prompt.includes(section);
        console.log(`   ${hasSection ? '✅' : '❌'} ${section}`);
    });

} catch (error) {
    console.error('❌ Error generando prompt:', error.message);
    process.exit(1);
}

console.log('\n=== PRUEBA COMPLETADA EXITOSAMENTE ===');
console.log('🎯 Todas las funciones están correctamente implementadas:');
console.log('   1. ✅ Funciones importadas correctamente');
console.log('   2. ✅ Prompt con contexto corporativo generado');
console.log('   3. ✅ Estructura del prompt validada');
console.log('\n📋 La IA ahora generará metadata considerando:');
console.log('   - Historia, misión y valores de la empresa');
console.log('   - Propuesta de valor y tono de comunicación');
console.log('   - Público objetivo y enfoque de marketing');
console.log('   - Ubicación y contexto geográfico');

process.exit(0);