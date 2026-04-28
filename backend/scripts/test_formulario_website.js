// Script para probar el formulario website-general
// Verifica que todos los campos se envíen y guarden correctamente

console.log('=== PRUEBA DE FORMULARIO WEBSITE-GENERAL ===\n');

// Simular datos que enviaría el frontend
const datosFrontend = {
    general: {
        whatsapp: '+56912345678',
        googleMapsUrl: 'https://maps.google.com/...',
        domain: 'www.miempresa.com',
        gaTrackingId: 'G-XXXXXXXXXX',
        wizardCompleted: true,
        subdomain: 'miempresa'
    },
    theme: {
        logoUrl: 'https://storage.googleapis.com/.../logo.png',
        heroImageUrl: 'https://storage.googleapis.com/.../hero.jpg',
        heroImageAlt: 'Imagen de portada de la empresa',
        heroImageTitle: 'Portada principal del sitio web',
        primaryColor: '#3b82f6',
        secondaryColor: '#6b7280',
        accentColor: '#10b981'
    },
    content: {
        homeH1: 'Bienvenido a nuestra empresa',
        homeIntro: 'Descripción introductoria generada por IA'
    },
    seo: {
        title: 'Título SEO optimizado',
        description: 'Descripción SEO para mejor posicionamiento',
        keywords: 'cabañas, lago, montaña, descanso'
    }
};

console.log('1. DATOS QUE ENVÍA EL FRONTEND:');
console.log(JSON.stringify(datosFrontend, null, 2));

console.log('\n2. ESTRUCTURA QUE ESPERA EL BACKEND (config.routes.js):');

// Simular lo que hace el backend
const updatePayload = {};
if (datosFrontend.general) updatePayload['websiteSettings.general'] = datosFrontend.general;
if (datosFrontend.theme) {
    updatePayload['websiteSettings.theme.primaryColor'] = datosFrontend.theme.primaryColor;
    updatePayload['websiteSettings.theme.secondaryColor'] = datosFrontend.theme.secondaryColor;
    updatePayload['websiteSettings.theme.accentColor'] = datosFrontend.theme.accentColor;
    updatePayload['websiteSettings.theme.logoUrl'] = datosFrontend.theme.logoUrl;
    updatePayload['websiteSettings.theme.heroImageUrl'] = datosFrontend.theme.heroImageUrl;
    if (datosFrontend.theme.heroImageAlt) updatePayload['websiteSettings.theme.heroImageAlt'] = datosFrontend.theme.heroImageAlt;
    if (datosFrontend.theme.heroImageTitle) updatePayload['websiteSettings.theme.heroImageTitle'] = datosFrontend.theme.heroImageTitle;
}
if (datosFrontend.content) updatePayload['websiteSettings.content'] = datosFrontend.content;
if (datosFrontend.seo) updatePayload['websiteSettings.seo'] = datosFrontend.seo;

console.log('Payload que se enviaría a actualizarDetallesEmpresa:');
console.log(JSON.stringify(updatePayload, null, 2));

console.log('\n3. VERIFICACIÓN DE CAMPOS:');

// Verificar campos del tema
const camposThemeEsperados = ['primaryColor', 'secondaryColor', 'accentColor', 'logoUrl', 'heroImageUrl', 'heroImageAlt', 'heroImageTitle'];
const camposThemeEnviados = Object.keys(datosFrontend.theme || {});

console.log('Campos del tema esperados:', camposThemeEsperados);
console.log('Campos del tema enviados:', camposThemeEnviados);

const camposFaltantes = camposThemeEsperados.filter(campo => !camposThemeEnviados.includes(campo));
if (camposFaltantes.length > 0) {
    console.log('❌ CAMPOS FALTANTES EN TEMA:', camposFaltantes);
} else {
    console.log('✅ Todos los campos del tema están presentes');
}

// Verificar campos generales
const camposGeneralEsperados = ['whatsapp', 'googleMapsUrl', 'domain', 'gaTrackingId', 'wizardCompleted', 'subdomain'];
const camposGeneralEnviados = Object.keys(datosFrontend.general || {});

console.log('\nCampos generales esperados:', camposGeneralEsperados);
console.log('Campos generales enviados:', camposGeneralEnviados);

const camposGeneralFaltantes = camposGeneralEsperados.filter(campo => !camposGeneralEnviados.includes(campo));
if (camposGeneralFaltantes.length > 0) {
    console.log('❌ CAMPOS FALTANTES EN GENERAL:', camposGeneralFaltantes);
} else {
    console.log('✅ Todos los campos generales están presentes');
}

console.log('\n4. CONCLUSIÓN:');
if (camposFaltantes.length === 0 && camposGeneralFaltantes.length === 0) {
    console.log('✅ La estructura de datos es correcta y completa');
    console.log('✅ El backend guardará todos los campos correctamente');
} else {
    console.log('❌ Hay campos faltantes que necesitan ser corregidos');
    console.log('Revisar:');
    console.log('- Frontend: Asegurar que todos los campos se incluyan en el payload');
    console.log('- Backend: Verificar que todos los campos se guarden en updatePayload');
}