// Simular el flujo completo del frontend
console.log('=== SIMULACIÓN DE FLUJO FRONTEND ===\n');

// Simular los datos que vendrían del backend
const empresaDataFromBackend = {
    id: 'SdPX7OBmThlOldlxsIq8',
    nombre: 'Orillas del Coilaco',
    websiteSettings: {
        seo: {
            title: "Meta título de prueba",
            keywords: "prueba, test, alojamiento",
            description: "Meta descripción de prueba"
        },
        theme: {
            logoUrl: "https://storage.googleapis.com/.../logo.webp",
            heroImageAlt: "Texto alternativo de prueba",
            heroImageUrl: "https://storage.googleapis.com/.../hero.webp",
            primaryColor: "#3b82f6",
            heroImageTitle: "Título de imagen de prueba",
            secondaryColor: "#6b7280"
        },
        domain: "prueba-test.onrender.com",
        content: {
            homeH1: "Título de prueba H1",
            homeIntro: "Introducción de prueba para el sitio web"
        },
        general: {
            domain: "prueba-test.onrender.com",
            whatsapp: "+56912345678",
            subdomain: "prueba-test",
            gaTrackingId: "G-TEST123",
            googleMapsUrl: "https://maps.google.com/...",
            wizardCompleted: true
        },
        subdomain: "prueba-test"
    }
};

console.log('📥 DATOS QUE RECIBE EL FRONTEND DESDE /empresa:');
console.log(JSON.stringify(empresaDataFromBackend, null, 2));

// Simular la función renderUnified
function simularRenderUnified(empresaData) {
    console.log('\n🎨 SIMULANDO renderUnified...');

    const empresa = empresaData || {};
    const settings = empresa.websiteSettings || {};
    const general = settings.general || {};
    const theme = settings.theme || {};

    console.log('📊 Datos extraídos para renderizado:');
    console.log(`- empresa.websiteSettings: ${!!empresa.websiteSettings ? 'PRESENTE' : 'AUSENTE'}`);
    console.log(`- settings.general: ${JSON.stringify(general)}`);
    console.log(`- settings.theme: ${JSON.stringify(theme)}`);

    console.log('\n🔍 Valores específicos que se usarían en el template:');
    console.log(`- theme.heroImageUrl: ${theme.heroImageUrl || 'NO'}`);
    console.log(`- theme.heroImageAlt: ${theme.heroImageAlt || 'NO'}`);
    console.log(`- theme.heroImageTitle: ${theme.heroImageTitle || 'NO'}`);
    console.log(`- general.subdomain: ${general.subdomain || 'NO'}`);

    // Simular el template string
    const template = `
        <!-- Imagen Hero -->
        <img id="hero-preview" src="${theme.heroImageUrl || 'noHero'}" alt="Portada">
        <input type="hidden" id="hero-url" value="${theme.heroImageUrl || ''}">

        <!-- Metadata en contenido generado -->
        <p id="content-hero-alt">${theme.heroImageAlt || 'Se generará automáticamente'}</p>
        <p id="content-hero-title">${theme.heroImageTitle || 'Se generará automáticamente'}</p>

        <!-- Subdominio info -->
        <span>${general.subdomain || empresa.nombre?.toLowerCase().replace(/[^a-z0-9]/g, '')}.onrender.com</span>
    `;

    console.log('\n📝 TEMPLATE GENERADO (fragmento):');
    console.log(template);

    return template;
}

// Simular el flujo de guardado
function simularFlujoGuardado() {
    console.log('\n🔄 SIMULANDO FLUJO DE GUARDADO...');

    // 1. Recolectar datos del formulario (simulado)
    const payloadFrontend = {
        websiteSettings: {
            general: {
                whatsapp: "+56912345678",
                googleMapsUrl: "https://maps.google.com/...",
                domain: "prueba-test.onrender.com",
                gaTrackingId: "G-TEST123",
                wizardCompleted: true,
                subdomain: "prueba-test"
            },
            theme: {
                logoUrl: "https://storage.googleapis.com/.../logo.webp",
                heroImageUrl: "https://storage.googleapis.com/.../hero.webp",
                heroImageAlt: "Texto alternativo de prueba",
                heroImageTitle: "Título de imagen de prueba",
                primaryColor: "#3b82f6",
                secondaryColor: "#6b7280",
                accentColor: "#10b981"
            }
        }
    };

    console.log('📤 Payload que envía el frontend:');
    console.log(JSON.stringify(payloadFrontend, null, 2));

    // 2. Simular lo que hace el backend
    const settings = payloadFrontend.websiteSettings;
    const websiteSettings = {};

    if (settings.general) {
        websiteSettings.general = settings.general;
        if (settings.general.subdomain) websiteSettings.subdomain = settings.general.subdomain;
        if (settings.general.domain) websiteSettings.domain = settings.general.domain;
    }

    if (settings.theme) {
        websiteSettings.theme = {
            primaryColor: settings.theme.primaryColor,
            secondaryColor: settings.theme.secondaryColor,
            logoUrl: settings.theme.logoUrl || ''
        };
        if (settings.theme.heroImageUrl) websiteSettings.theme.heroImageUrl = settings.theme.heroImageUrl;
        if (settings.theme.heroImageAlt) websiteSettings.theme.heroImageAlt = settings.theme.heroImageAlt;
        if (settings.theme.heroImageTitle) websiteSettings.theme.heroImageTitle = settings.theme.heroImageTitle;
    }

    console.log('\n📝 websiteSettings construido por backend:');
    console.log(JSON.stringify(websiteSettings, null, 2));

    // 3. Verificar que los datos críticos están
    console.log('\n✅ VERIFICACIÓN DE DATOS CRÍTICOS:');
    console.log(`✓ websiteSettings.subdomain: ${websiteSettings.subdomain || 'FALTA'}`);
    console.log(`✓ websiteSettings.theme.heroImageAlt: ${websiteSettings.theme?.heroImageAlt || 'FALTA'}`);
    console.log(`✓ websiteSettings.theme.heroImageTitle: ${websiteSettings.theme?.heroImageTitle || 'FALTA'}`);
}

// Ejecutar simulaciones
console.log('\n=== PRIMERA PARTE: RENDERIZADO INICIAL ===');
simularRenderUnified(empresaDataFromBackend);

console.log('\n=== SEGUNDA PARTE: FLUJO DE GUARDADO ===');
simularFlujoGuardado();

// Probar problema común: datos vacíos después de guardar
console.log('\n=== DIAGNÓSTICO DE PROBLEMA COMÚN ===');
console.log('Problema: "Después de guardar, se recarga y queda vacío"');

console.log('\n🔍 POSIBLES CAUSAS:');
console.log('1. ✅ Los datos SÍ se guardan en BD (verificado)');
console.log('2. ✅ Los datos SÍ se recuperan de BD (verificado)');
console.log('3. ❓ El callback onComplete no funciona correctamente');
console.log('4. ❓ Hay un error en _render() o en la recarga de datos');
console.log('5. ❓ Los datos no se pasan correctamente a renderUnified');

console.log('\n💡 SUGERENCIA: Revisar en frontend:');
console.log('1. Consola del navegador (F12) para errores');
console.log('2. Network tab para ver respuesta de /empresa después de guardar');
console.log('3. Verificar que _fullEmpresaData se actualiza correctamente');
console.log('4. Verificar que renderUnified recibe los datos actualizados');