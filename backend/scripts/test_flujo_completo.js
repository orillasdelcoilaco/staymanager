// Script para probar el flujo completo del formulario website-general
// Simula: 1) Subir imagen hero, 2) Guardar configuración completa

console.log('=== PRUEBA DE FLUJO COMPLETO WEBSITE-GENERAL ===\n');

// Simular empresa de prueba
const empresaId = 'empresa-test-123';
const datosIniciales = {
    id: empresaId,
    nombre: 'Empresa Test',
    websiteSettings: {
        general: {
            whatsapp: '+56987654321',
            subdomain: 'test-antiguo'
        },
        theme: {
            primaryColor: '#000000',
            secondaryColor: '#666666'
        }
    }
};

console.log('1. ESTADO INICIAL DE LA EMPRESA:');
console.log(JSON.stringify(datosIniciales, null, 2));

// Simular subida de imagen hero (como lo haría /upload-hero-image)
console.log('\n2. SIMULAR SUBIDA DE IMAGEN HERO:');
const heroUpdatePayload = {
    'websiteSettings.theme.heroImageUrl': 'https://storage.googleapis.com/empresa-test/hero-abc123.webp',
    'websiteSettings.theme.heroImageAlt': 'Imagen de portada generada por IA',
    'websiteSettings.theme.heroImageTitle': 'Portada principal - Empresa Test'
};

console.log('Payload de actualización de hero:', JSON.stringify(heroUpdatePayload, null, 2));

// Simular guardado completo (como lo haría /home-settings)
console.log('\n3. SIMULAR GUARDADO COMPLETO (/home-settings):');
const settingsCompletas = {
    general: {
        whatsapp: '+56912345678',
        googleMapsUrl: 'https://maps.google.com/...',
        domain: 'www.empresatest.com',
        gaTrackingId: 'G-TEST123456',
        wizardCompleted: true,
        subdomain: 'empresatest'
    },
    theme: {
        logoUrl: 'https://storage.googleapis.com/empresa-test/logo.png',
        heroImageUrl: 'https://storage.googleapis.com/empresa-test/hero-abc123.webp', // Misma URL de hero
        heroImageAlt: 'Imagen de portada generada por IA',
        heroImageTitle: 'Portada principal - Empresa Test',
        primaryColor: '#3b82f6',
        secondaryColor: '#6b7280',
        accentColor: '#10b981'
    },
    content: {
        homeH1: 'Bienvenido a Empresa Test',
        homeIntro: 'La mejor experiencia en alojamientos turísticos'
    },
    seo: {
        title: 'Empresa Test - Alojamientos Premium',
        description: 'Descubre nuestros exclusivos alojamientos con todas las comodidades',
        keywords: 'alojamiento, turismo, descanso, naturaleza'
    }
};

console.log('Datos completos a guardar:', JSON.stringify(settingsCompletas, null, 2));

// Simular lo que hace el backend en /home-settings
const updatePayload = {};
if (settingsCompletas.general) updatePayload['websiteSettings.general'] = settingsCompletas.general;
if (settingsCompletas.theme) {
    updatePayload['websiteSettings.theme.primaryColor'] = settingsCompletas.theme.primaryColor;
    updatePayload['websiteSettings.theme.secondaryColor'] = settingsCompletas.theme.secondaryColor;
    updatePayload['websiteSettings.theme.accentColor'] = settingsCompletas.theme.accentColor;
    updatePayload['websiteSettings.theme.logoUrl'] = settingsCompletas.theme.logoUrl;
    updatePayload['websiteSettings.theme.heroImageUrl'] = settingsCompletas.theme.heroImageUrl;
    if (settingsCompletas.theme.heroImageAlt) updatePayload['websiteSettings.theme.heroImageAlt'] = settingsCompletas.theme.heroImageAlt;
    if (settingsCompletas.theme.heroImageTitle) updatePayload['websiteSettings.theme.heroImageTitle'] = settingsCompletas.theme.heroImageTitle;
}
if (settingsCompletas.content) updatePayload['websiteSettings.content'] = settingsCompletas.content;
if (settingsCompletas.seo) updatePayload['websiteSettings.seo'] = settingsCompletas.seo;

console.log('\n4. PAYLOAD FINAL QUE SE GUARDARÍA EN LA BD:');
console.log(JSON.stringify(updatePayload, null, 2));

// Verificar integridad de datos
console.log('\n5. VERIFICACIÓN DE INTEGRIDAD:');

// Verificar que heroImageUrl está presente
if (updatePayload['websiteSettings.theme.heroImageUrl']) {
    console.log(`✅ heroImageUrl está presente: ${updatePayload['websiteSettings.theme.heroImageUrl']}`);
} else {
    console.log('❌ ERROR: heroImageUrl NO está presente en el payload');
}

// Verificar que heroImageAlt está presente
if (updatePayload['websiteSettings.theme.heroImageAlt']) {
    console.log(`✅ heroImageAlt está presente: ${updatePayload['websiteSettings.theme.heroImageAlt']}`);
} else {
    console.log('❌ ERROR: heroImageAlt NO está presente en el payload');
}

// Verificar que heroImageTitle está presente
if (updatePayload['websiteSettings.theme.heroImageTitle']) {
    console.log(`✅ heroImageTitle está presente: ${updatePayload['websiteSettings.theme.heroImageTitle']}`);
} else {
    console.log('❌ ERROR: heroImageTitle NO está presente en el payload');
}

// Verificar que todos los campos del tema están presentes
const camposTheme = ['primaryColor', 'secondaryColor', 'accentColor', 'logoUrl', 'heroImageUrl', 'heroImageAlt', 'heroImageTitle'];
const camposPresentes = camposTheme.filter(campo => updatePayload[`websiteSettings.theme.${campo}`] !== undefined);

console.log(`\nCampos del tema presentes: ${camposPresentes.length}/${camposTheme.length}`);
if (camposPresentes.length === camposTheme.length) {
    console.log('✅ Todos los campos del tema están presentes');
} else {
    const faltantes = camposTheme.filter(campo => !updatePayload[`websiteSettings.theme.${campo}`]);
    console.log('❌ Campos faltantes:', faltantes);
}

// Simular estado final de la empresa
console.log('\n6. ESTADO FINAL SIMULADO DE LA EMPRESA:');
const estadoFinal = {
    ...datosIniciales,
    websiteSettings: {
        general: settingsCompletas.general,
        theme: {
            primaryColor: updatePayload['websiteSettings.theme.primaryColor'],
            secondaryColor: updatePayload['websiteSettings.theme.secondaryColor'],
            accentColor: updatePayload['websiteSettings.theme.accentColor'],
            logoUrl: updatePayload['websiteSettings.theme.logoUrl'],
            heroImageUrl: updatePayload['websiteSettings.theme.heroImageUrl'],
            heroImageAlt: updatePayload['websiteSettings.theme.heroImageAlt'],
            heroImageTitle: updatePayload['websiteSettings.theme.heroImageTitle']
        },
        content: settingsCompletas.content,
        seo: settingsCompletas.seo
    }
};

console.log(JSON.stringify(estadoFinal, null, 2));

console.log('\n7. CONCLUSIÓN:');
console.log('El flujo debería funcionar correctamente si:');
console.log('1. ✅ El frontend envía todos los campos en la estructura correcta');
console.log('2. ✅ El backend (/home-settings) procesa y guarda todos los campos');
console.log('3. ✅ Los campos de imagen (heroImageUrl, heroImageAlt, heroImageTitle) se preservan');

console.log('\n⚠️ POSIBLES PROBLEMAS:');
console.log('- Si heroImageUrl no se guarda: Verificar que el frontend incluya heroImageUrl en theme');
console.log('- Si heroImageAlt/heroImageTitle no se guardan: Verificar inputs hidden en frontend');
console.log('- Si los colores no se guardan: Verificar que accentColor esté en el payload');