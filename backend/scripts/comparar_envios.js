// COMPARAR: Lo que envía MI SCRIPT vs Lo que envía EL FORMULARIO
console.log('=== COMPARACIÓN EXACTA: MI SCRIPT vs FORMULARIO ===\n');

// 1. LO QUE ENVÍA MI SCRIPT (test_guardado_config.js)
const payloadMiScript = {
    general: {
        whatsapp: "+56912345678",
        googleMapsUrl: "https://maps.google.com/...",
        domain: "prueba-test.onrender.com",
        gaTrackingId: "G-TEST123",
        wizardCompleted: true,
        subdomain: "prueba-test"  // ← ¡ESTE ESTÁ!
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
        homeH1: "Título de prueba H1",
        homeIntro: "Introducción de prueba para el sitio web"
    },
    seo: {
        title: "Meta título de prueba",
        description: "Meta descripción de prueba",
        keywords: "prueba, test, alojamiento"
    }
};

console.log('📤 1. LO QUE ENVÍA MI SCRIPT (funciona):');
console.log(JSON.stringify(payloadMiScript, null, 2));

// 2. LO QUE PROBABLEMENTE ENVÍA EL FORMULARIO (antes de la corrección)
const payloadFormularioViejo = {
    general: {
        whatsapp: "+56912345678",
        googleMapsUrl: "https://maps.google.com/...",
        domain: "prueba-test.onrender.com",
        gaTrackingId: "G-TEST123",
        wizardCompleted: true
        // ¡FALTABA: subdomain!
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

console.log('\n📤 2. LO QUE ENVIABA EL FORMULARIO (problema):');
console.log(JSON.stringify(payloadFormularioViejo, null, 2));

// 3. LO QUE DEBERÍA ENVIAR EL FORMULARIO (después de corrección)
const payloadFormularioCorregido = {
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

console.log('\n📤 3. LO QUE DEBERÍA ENVIAR EL FORMULARIO (corregido):');
console.log(JSON.stringify(payloadFormularioCorregido, null, 2));

// 4. COMPARACIÓN DETALLADA
console.log('\n🔍 COMPARACIÓN DETALLADA:');

console.log('\n✅ MI SCRIPT TIENE (funciona):');
console.log(`- general.subdomain: "${payloadMiScript.general.subdomain}"`);

console.log('\n❌ FORMULARIO VIEJO (no funcionaba):');
console.log(`- general.subdomain: "${payloadFormularioViejo.general.subdomain || 'FALTABA'}"`);

console.log('\n✅ FORMULARIO CORREGIDO (debería funcionar):');
console.log(`- general.subdomain: "${payloadFormularioCorregido.general.subdomain}"`);

// 5. VERIFICAR QUÉ PASA EN EL BACKEND
console.log('\n🔧 QUÉ HACE EL BACKEND CON ESTOS DATOS:');

function simularBackend(payload) {
    const websiteSettings = {};

    if (payload.general) {
        websiteSettings.general = payload.general;
        if (payload.general.subdomain) websiteSettings.subdomain = payload.general.subdomain;
        if (payload.general.domain) websiteSettings.domain = payload.general.domain;
    }

    if (payload.theme) {
        websiteSettings.theme = {
            primaryColor: payload.theme.primaryColor,
            secondaryColor: payload.theme.secondaryColor,
            logoUrl: payload.theme.logoUrl || ''
        };
        if (payload.theme.heroImageUrl) websiteSettings.theme.heroImageUrl = payload.theme.heroImageUrl;
        if (payload.theme.heroImageAlt) websiteSettings.theme.heroImageAlt = payload.theme.heroImageAlt;
        if (payload.theme.heroImageTitle) websiteSettings.theme.heroImageTitle = payload.theme.heroImageTitle;
    }

    if (payload.content) websiteSettings.content = payload.content;
    if (payload.seo) websiteSettings.seo = payload.seo;

    return websiteSettings;
}

console.log('\n📝 websiteSettings generado por MI SCRIPT:');
const wsMiScript = simularBackend(payloadMiScript);
console.log(JSON.stringify(wsMiScript, null, 2));

console.log('\n📝 websiteSettings generado por FORMULARIO VIEJO:');
const wsFormularioViejo = simularBackend(payloadFormularioViejo);
console.log(JSON.stringify(wsFormularioViejo, null, 2));

console.log('\n📝 websiteSettings generado por FORMULARIO CORREGIDO:');
const wsFormularioCorregido = simularBackend(payloadFormularioCorregido);
console.log(JSON.stringify(wsFormularioCorregido, null, 2));

// 6. CONCLUSIÓN
console.log('\n🎯 CONCLUSIÓN:');

if (wsMiScript.subdomain && wsFormularioCorregido.subdomain) {
    console.log('✅ AMBOS (mi script y formulario corregido) guardarán subdomain correctamente');
    console.log(`   Mi script: ${wsMiScript.subdomain}`);
    console.log(`   Formulario: ${wsFormularioCorregido.subdomain}`);
} else {
    console.log('❌ PROBLEMA:');
    console.log(`   Mi script tiene subdomain: ${!!wsMiScript.subdomain}`);
    console.log(`   Formulario tiene subdomain: ${!!wsFormularioCorregido.subdomain}`);
}

console.log('\n💡 PRUEBA AHORA:');
console.log('1. Abre el formulario en el navegador');
console.log('2. Verifica que hay un campo "Subdominio"');
console.log('3. Escribe "prueba1" en el campo Subdominio');
console.log('4. Haz clic en "Guardar Todo"');
console.log('5. Abre consola (F12) y verifica logs');
console.log('6. Los logs deben mostrar: "[FRONTEND] Enviando datos a /website/home-settings:"');
console.log('7. Verifica que en los datos enviados está "subdomain": "prueba1"');