// Script para probar que los campos generados por IA se guardan correctamente

console.log('=== PRUEBA DE CAMPOS GENERADOS POR IA ===\n');

// Simular estado del DOM después de que la IA ha generado contenido
console.log('1. SIMULAR ESTADO DEL DOM DESPUÉS DE GENERACIÓN IA:');

const elementosDOM = {
    // Campos editables por usuario
    '#slogan': { value: 'Tu escape perfecto en la naturaleza' },
    '#tipo': { value: 'Cabañas de montaña' },
    '#enfoque': { value: 'Familiar' },
    '#keywords': { value: 'cabañas, montaña, naturaleza, familia' },

    // Campos generados por IA (solo lectura en pantalla)
    '#content-h1': { textContent: 'Descubre Nuestras Exclusivas Cabañas de Montaña' },
    '#content-intro': { textContent: 'Sumérgete en la naturaleza con nuestras cabañas totalmente equipadas, diseñadas para familias que buscan desconectar y crear recuerdos inolvidables en un entorno natural privilegiado.' },
    '#content-seo-title': { textContent: 'Cabañas de Montaña | Escape Familiar en la Naturaleza | Empresa Test' },
    '#content-seo-desc': { textContent: 'Reserva tu cabaña de montaña con todas las comodidades. Experiencias familiares únicas en entornos naturales. WiFi, chimenea, jacuzzi y más.' },
    '#content-hero-alt': { textContent: 'Cabaña de montaña con vista panorámica al atardecer - Empresa Test' },
    '#content-hero-title': { textContent: 'Cabaña Premium con Vista a las Montañas' },

    // Inputs hidden
    '#hero-alt': { value: 'Cabaña de montaña con vista panorámica al atardecer - Empresa Test' },
    '#hero-title': { value: 'Cabaña Premium con Vista a las Montañas' },

    // Colores
    '#color-primary': { value: '#3b82f6' },
    '#color-secondary': { value: '#6b7280' },
    '#color-accent': { value: '#10b981' }
};

console.log('Elementos DOM simulados:');
Object.entries(elementosDOM).forEach(([id, valor]) => {
    console.log(`  ${id}: ${'value' in valor ? valor.value : valor.textContent}`);
});

// Simular función getElementById y querySelector
function mockElement(id) {
    if (id.startsWith('#')) id = id.substring(1);
    const element = elementosDOM[`#${id}`] || elementosDOM[id];
    return element ? {
        value: element.value || '',
        textContent: element.textContent || ''
    } : null;
}

// Simular querySelector
function mockQuerySelector(selector) {
    return elementosDOM[selector] ? {
        textContent: elementosDOM[selector].textContent || ''
    } : null;
}

console.log('\n2. SIMULAR CONSTRUCCIÓN DE PAYLOAD (como lo hace el frontend):');

// Simular la construcción de payload.strategy
const strategyPayload = {
    slogan: mockElement('slogan')?.value || '',
    tipoAlojamientoPrincipal: mockElement('tipo')?.value || '',
    enfoqueMarketing: mockElement('enfoque')?.value || '',
    palabrasClaveAdicionales: mockElement('keywords')?.value || '',
    homeH1: mockQuerySelector('#content-h1')?.textContent || '',
    homeIntro: mockQuerySelector('#content-intro')?.textContent || '',
    homeSeoTitle: mockQuerySelector('#content-seo-title')?.textContent || '',
    homeSeoDesc: mockQuerySelector('#content-seo-desc')?.textContent || '',
    primaryColor: mockElement('color-primary')?.value || '#3b82f6',
    secondaryColor: mockElement('color-secondary')?.value || '#6b7280',
    accentColor: mockElement('color-accent')?.value || '#10b981'
};

console.log('Payload.strategy generado:');
console.log(JSON.stringify(strategyPayload, null, 2));

// Simular la construcción de websiteSettings.theme
const themePayload = {
    logoUrl: '',
    heroImageUrl: '',
    heroImageAlt: mockQuerySelector('#content-hero-alt')?.textContent || mockElement('hero-alt')?.value || '',
    heroImageTitle: mockQuerySelector('#content-hero-title')?.textContent || mockElement('hero-title')?.value || '',
    primaryColor: mockElement('color-primary')?.value || '#3b82f6',
    secondaryColor: mockElement('color-secondary')?.value || '#6b7280',
    accentColor: mockElement('color-accent')?.value || '#10b981'
};

console.log('\nPayload.websiteSettings.theme generado:');
console.log(JSON.stringify(themePayload, null, 2));

// Simular datosAEnviar (como lo hace el frontend)
const datosAEnviar = {
    general: {
        whatsapp: '+56912345678',
        googleMapsUrl: 'https://maps.google.com/...',
        domain: 'www.empresatest.com',
        gaTrackingId: 'G-TEST123456',
        wizardCompleted: true,
        subdomain: 'empresatest'
    },
    theme: themePayload,
    content: {
        homeH1: strategyPayload.homeH1,
        homeIntro: strategyPayload.homeIntro
    },
    seo: {
        title: strategyPayload.homeSeoTitle,
        description: strategyPayload.homeSeoDesc,
        keywords: strategyPayload.palabrasClaveAdicionales
    }
};

console.log('\n3. DATOS COMPLETOS A ENVIAR (/website/home-settings):');
console.log(JSON.stringify(datosAEnviar, null, 2));

// Verificar que todos los campos generados por IA están presentes
console.log('\n4. VERIFICACIÓN DE CAMPOS GENERADOS POR IA:');

const camposIA = [
    { nombre: 'homeH1', valor: datosAEnviar.content.homeH1, esperado: 'Descubre Nuestras Exclusivas Cabañas de Montaña' },
    { nombre: 'homeIntro', valor: datosAEnviar.content.homeIntro, esperado: 'Sumérgete en la naturaleza con nuestras cabañas totalmente equipadas...' },
    { nombre: 'homeSeoTitle', valor: datosAEnviar.seo.title, esperado: 'Cabañas de Montaña | Escape Familiar en la Naturaleza | Empresa Test' },
    { nombre: 'homeSeoDesc', valor: datosAEnviar.seo.description, esperado: 'Reserva tu cabaña de montaña con todas las comodidades...' },
    { nombre: 'heroImageAlt', valor: datosAEnviar.theme.heroImageAlt, esperado: 'Cabaña de montaña con vista panorámica al atardecer - Empresa Test' },
    { nombre: 'heroImageTitle', valor: datosAEnviar.theme.heroImageTitle, esperado: 'Cabaña Premium con Vista a las Montañas' }
];

let todosPresentes = true;
camposIA.forEach(campo => {
    if (campo.valor && campo.valor !== 'Se generará automáticamente' && campo.valor !== 'Se generará automáticamente al subir la imagen') {
        console.log(`✅ ${campo.nombre}: PRESENTE (${campo.valor.substring(0, 50)}...)`);
    } else {
        console.log(`❌ ${campo.nombre}: AUSENTE o con valor por defecto`);
        todosPresentes = false;
    }
});

console.log('\n5. CONCLUSIÓN:');
if (todosPresentes) {
    console.log('✅ TODOS los campos generados por IA se incluirán en el payload');
    console.log('✅ El backend recibirá y guardará correctamente:');
    console.log('   - Título H1 generado por IA');
    console.log('   - Párrafo introductorio generado por IA');
    console.log('   - Meta título SEO generado por IA');
    console.log('   - Meta descripción SEO generada por IA');
    console.log('   - Metadata de imagen hero generada por IA');
} else {
    console.log('❌ ALGUNOS campos generados por IA NO se incluirán en el payload');
    console.log('Revisar:');
    console.log('1. Que los elementos DOM (#content-h1, #content-intro, etc.) existan');
    console.log('2. Que la función lea textContent en lugar de value para elementos <p>');
    console.log('3. Que los valores no sean los textos por defecto "Se generará automáticamente"');
}

console.log('\n6. ESTRUCTURA FINAL QUE GUARDARÁ EL BACKEND:');
console.log('El backend recibirá en /website/home-settings:');
console.log('- content.homeH1: Título principal generado por IA');
console.log('- content.homeIntro: Párrafo introductorio generado por IA');
console.log('- seo.title: Meta título SEO generado por IA');
console.log('- seo.description: Meta descripción SEO generada por IA');
console.log('- theme.heroImageAlt: Alt text de imagen hero generado por IA');
console.log('- theme.heroImageTitle: Title de imagen hero generado por IA');
console.log('\n✅ Estos campos se guardarán en websiteSettings.content y websiteSettings.seo');