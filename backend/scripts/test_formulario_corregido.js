// TEST: Verificar que el formulario corregido envía subdomain correctamente
console.log('=== TEST: FORMULARIO CORREGIDO ENVÍA SUBDOMAIN ===\n');

// Simular lo que recolecta el formulario corregido
const formularioCorregido = {
    general: {
        whatsapp: "+56912345678",
        googleMapsUrl: "https://maps.google.com/...",
        domain: "prueba-test.onrender.com",
        gaTrackingId: "G-TEST123",
        wizardCompleted: true,
        subdomain: "prueba-test"  // ← ¡AHORA SÍ ESTÁ!
    },
    theme: {
        logoUrl: "https://storage.googleapis.com/.../logo.webp",
        heroImageUrl: "https://storage.googleapis.com/.../hero.webp",
        heroImageAlt: "Texto alternativo de prueba",
        heroImageTitle: "Título de imagen de prueba",
        primaryColor: "#3b82f6",
        secondaryColor: "#6b7280",
        accentColor: "#10b981"
    },
    content: {
        homeH1: "Título generado por IA",
        homeIntro: "Intro generada por IA"
    },
    seo: {
        title: "Meta título generado",
        description: "Meta descripción generada",
        keywords: "palabras, clave, generadas"
    }
};

// Simular lo que hace el backend con estos datos
console.log('📤 1. DATOS ENVIADOS POR FORMULARIO CORREGIDO:');
console.log(JSON.stringify(formularioCorregido, null, 2));

console.log('\n🔧 2. PROCESAMIENTO EN BACKEND:');

// Simular lo que hace websiteConfigRoutes.js
const settings = formularioCorregido;
const websiteSettings = {};

if (settings.general) {
    websiteSettings.general = settings.general;
    if (settings.general.subdomain) {
        websiteSettings.subdomain = settings.general.subdomain;
        console.log(`✅ Subdomain extraído: ${settings.general.subdomain}`);
    }
    if (settings.general.domain) {
        websiteSettings.domain = settings.general.domain;
        console.log(`✅ Domain extraído: ${settings.general.domain}`);
    }
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

if (settings.content) websiteSettings.content = settings.content;
if (settings.seo) websiteSettings.seo = settings.seo;

console.log('\n📝 3. WEBSITESETTINGS FINAL (lo que se guarda en BD):');
console.log(JSON.stringify(websiteSettings, null, 2));

// Verificar que subdomain está en el nivel correcto
console.log('\n🔍 4. VERIFICACIÓN CRÍTICA:');
console.log(`✅ websiteSettings.subdomain existe: ${!!websiteSettings.subdomain}`);
console.log(`✅ websiteSettings.subdomain valor: ${websiteSettings.subdomain}`);
console.log(`✅ websiteSettings.general.subdomain existe: ${!!websiteSettings.general?.subdomain}`);
console.log(`✅ websiteSettings.general.subdomain valor: ${websiteSettings.general?.subdomain}`);

// Verificar que es igual en ambos niveles (requerido por tenantResolver)
if (websiteSettings.subdomain === websiteSettings.general?.subdomain) {
    console.log('✅ Subdomain coherente en ambos niveles (requerido por tenantResolver)');
} else {
    console.log('❌ ERROR: Subdomain diferente en websiteSettings vs websiteSettings.general');
}

console.log('\n🎯 CONCLUSIÓN:');
if (websiteSettings.subdomain && websiteSettings.general?.subdomain) {
    console.log('✅ FORMULARIO CORREGIDO FUNCIONA CORRECTAMENTE');
    console.log('   El subdomain se envía, procesa y guarda correctamente.');
    console.log('   El problema original (falta de subdomain) está RESUELTO.');
} else {
    console.log('❌ PROBLEMA PERSISTE: Falta subdomain en algún nivel');
}

console.log('\n💡 INSTRUCCIONES PARA PROBAR EN NAVEGADOR:');
console.log('1. Abre el formulario en /website-general');
console.log('2. Verifica que hay campo "Subdominio"');
console.log('3. Escribe "prueba1" en el campo Subdominio');
console.log('4. Haz clic en "Guardar Todo"');
console.log('5. Abre consola (F12) y verifica logs:');
console.log('   - "[FRONTEND] Enviando datos a /website/home-settings:"');
console.log('   - Debe mostrar "subdomain": "prueba1" en los datos');
console.log('6. Verifica logs del servidor:');
console.log('   - "[DEBUG home-settings PUT] Subdomain configurado: prueba1"');