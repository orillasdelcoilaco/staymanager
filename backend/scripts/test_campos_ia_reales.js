// Script para probar con los valores REALES que mencionas

console.log('=== PRUEBA CON VALORES REALES DEL FORMULARIO ===\n');

// Valores REALES que muestras en pantalla
const valoresReales = {
    // Campos generados por IA que se muestran en pantalla
    '#content-h1': 'Cabañas Familiares con Hot Tub en Pucón-Caburgua',
    '#content-intro': 'Escápate a la naturaleza y vive unas vacaciones inolvidables en nuestras cabañas. Disfruta de hot tub, playa privada, piscina y la magia de Pucón-Caburgua con tu familia.',
    '#content-seo-title': 'Cabañas Familiares Pucón-Caburgua: Hot Tub y Naturaleza',
    '#content-seo-desc': 'Cabañas equipadas en Pucón-Caburgua. Hot tub, playa privada, piscina y actividades familiares. ¡Reserva tus vacaciones en la naturaleza hoy mismo!',
    '#content-hero-alt': 'Se generará automáticamente al subir la imagen',
    '#content-hero-title': 'Se generará automáticamente al subir la imagen',

    // Inputs hidden (deberían tener los mismos valores)
    '#hero-alt': 'Se generará automáticamente al subir la imagen',
    '#hero-title': 'Se generará automáticamente al subir la imagen'
};

console.log('1. VALORES QUE SE MUESTRAN EN PANTALLA:');
Object.entries(valoresReales).forEach(([id, valor]) => {
    console.log(`  ${id}: ${valor.substring(0, 80)}${valor.length > 80 ? '...' : ''}`);
});

console.log('\n2. PROBLEMA IDENTIFICADO:');
console.log('Los campos #content-hero-alt y #content-hero-title dicen "Se generará automáticamente al subir la imagen"');
console.log('Esto significa que NO se ha subido una imagen hero o NO se ha generado metadata con IA');
console.log('Por lo tanto, estos campos NO se guardarán (están con valor por defecto)');

console.log('\n3. SIMULAR LO QUE HARÍA EL CÓDIGO ACTUAL:');

// Simular función querySelector
function mockQuerySelector(selector) {
    return valoresReales[selector] ? { textContent: valoresReales[selector] } : null;
}

// Simular función getElementById
function mockElement(id) {
    if (id.startsWith('#')) id = id.substring(1);
    const element = valoresReales[`#${id}`] || valoresReales[id];
    return element ? { value: element } : null;
}

// Simular construcción de payload.strategy
const homeH1 = mockQuerySelector('#content-h1')?.textContent || '';
const homeIntro = mockQuerySelector('#content-intro')?.textContent || '';
const homeSeoTitle = mockQuerySelector('#content-seo-title')?.textContent || '';
const homeSeoDesc = mockQuerySelector('#content-seo-desc')?.textContent || '';

console.log('Valores leídos del DOM:');
console.log(`- homeH1: "${homeH1.substring(0, 50)}..."`);
console.log(`- homeIntro: "${homeIntro.substring(0, 50)}..."`);
console.log(`- homeSeoTitle: "${homeSeoTitle.substring(0, 50)}..."`);
console.log(`- homeSeoDesc: "${homeSeoDesc.substring(0, 50)}..."`);

// Verificar si los valores son los por defecto
const esValorPorDefecto = (valor, textoPorDefecto) => {
    return valor === textoPorDefecto || valor.includes('Se generará automáticamente');
};

console.log('\n4. ANÁLISIS DE VALORES:');

const campos = [
    { nombre: 'homeH1', valor: homeH1, porDefecto: 'Se generará automáticamente' },
    { nombre: 'homeIntro', valor: homeIntro, porDefecto: 'Se generará automáticamente' },
    { nombre: 'homeSeoTitle', valor: homeSeoTitle, porDefecto: 'Se generará automáticamente' },
    { nombre: 'homeSeoDesc', valor: homeSeoDesc, porDefecto: 'Se generará automáticamente' }
];

campos.forEach(campo => {
    if (esValorPorDefecto(campo.valor, campo.porDefecto)) {
        console.log(`❌ ${campo.nombre}: VALOR POR DEFECTO ("${campo.valor.substring(0, 30)}...")`);
        console.log(`   Este campo NO se guardará porque tiene el texto por defecto`);
    } else {
        console.log(`✅ ${campo.nombre}: VALOR GENERADO POR IA`);
        console.log(`   Este campo SÍ se guardará: "${campo.valor.substring(0, 50)}..."`);
    }
});

console.log('\n5. CONCLUSIÓN:');
console.log('Basado en los valores que muestras:');
console.log('✅ homeH1: SE GUARDARÁ (tiene valor generado por IA)');
console.log('✅ homeIntro: SE GUARDARÁ (tiene valor generado por IA)');
console.log('✅ homeSeoTitle: SE GUARDARÁ (tiene valor generado por IA)');
console.log('✅ homeSeoDesc: SE GUARDARÁ (tiene valor generado por IA)');
console.log('❌ heroImageAlt: NO SE GUARDARÁ (valor por defecto)');
console.log('❌ heroImageTitle: NO SE GUARDARÁ (valor por defecto)');

console.log('\n6. SOLUCIÓN:');
console.log('Para que heroImageAlt y heroImageTitle se guarden, necesitas:');
console.log('1. Subir una imagen hero usando el botón "Imagen de Portada (Hero)"');
console.log('2. O generar metadata de imagen con IA usando el botón "Regenerar Todo"');
console.log('');
console.log('Una vez que la IA genere metadata para la imagen, los campos cambiarán de:');
console.log('   "Se generará automáticamente al subir la imagen"');
console.log('A algo como:');
console.log('   "Cabaña de montaña con vista al lago - Pucón-Caburgua"');
console.log('');
console.log('ENTONCES esos campos también se guardarán.');

console.log('\n7. VERIFICACIÓN FINAL:');
console.log('¿Los 4 campos principales (H1, Intro, SEO Title, SEO Desc) se están guardando?');
console.log('Revisa la consola del navegador después de hacer clic en "Guardar Todo"');
console.log('Busca los mensajes [FRONTEND DEBUG] para ver qué valores se están leyendo.');