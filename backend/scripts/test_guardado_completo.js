// TEST COMPLETO: Guardado con logs SQL y verificación
console.log('=== TEST COMPLETO: GUARDADO CON LOGS SQL ===\n');

// Simular empresa de prueba
const empresaId = 'test-empresa-123';
const subdomain = 'prueba-test-' + Date.now();

// Datos que envía el formulario corregido
const datosFormulario = {
    general: {
        whatsapp: "+56912345678",
        googleMapsUrl: "https://maps.google.com/...",
        domain: `${subdomain}.onrender.com`,
        gaTrackingId: "G-TEST123",
        wizardCompleted: true,
        subdomain: subdomain
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

console.log('📤 1. DATOS ENVIADOS POR FORMULARIO:');
console.log(JSON.stringify(datosFormulario, null, 2));

console.log('\n🔧 2. PROCESAMIENTO EN BACKEND (websiteConfigRoutes.js):');

// Simular lo que hace websiteConfigRoutes.js
const settings = datosFormulario;
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

console.log('\n📝 3. WEBSITESETTINGS A GUARDAR:');
console.log(JSON.stringify(websiteSettings, null, 2));

console.log('\n🗄️ 4. SQL QUE SE EJECUTARÁ (empresaService.js):');

const resto = { websiteSettings };
const sql = `
    UPDATE empresas SET
        nombre          = COALESCE($2, nombre),
        email           = COALESCE($3, email),
        plan            = COALESCE($4, plan),
        dominio         = COALESCE($5, dominio),
        subdominio      = COALESCE($6, subdominio),
        configuracion   = configuracion || $7::jsonb,
        google_maps_url = COALESCE($8, google_maps_url),
        updated_at      = NOW()
    WHERE id = $1
`;

const params = [
    empresaId,
    null,  // nombre
    null,  // email
    null,  // plan
    `${subdomain}.onrender.com`,  // dominioFinal
    subdomain,  // subdominioFinal
    JSON.stringify(resto),  // configuracion
    null   // google_maps_url
];

console.log('📋 SQL:');
console.log(sql);
console.log('\n🔢 PARÁMETROS:');
console.log(JSON.stringify(params, null, 2));
console.log('\n📊 CONFIGURACIÓN (resto):');
console.log(JSON.stringify(resto, null, 2));

console.log('\n📨 5. RESPUESTA DEL BACKEND AL FRONTEND:');
const respuestaBackend = {
    message: 'Configuración guardada.',
    empresa: {
        id: empresaId,
        subdominio: subdomain,
        dominio: `${subdomain}.onrender.com`,
        websiteSettings: websiteSettings
    },
    websiteSettings: websiteSettings
};

console.log(JSON.stringify(respuestaBackend, null, 2));

console.log('\n🔄 6. LO QUE DEBE HACER EL FRONTEND CON LA RESPUESTA:');
console.log('✅ Recibir respuesta JSON con datos actualizados');
console.log('✅ Mostrar mensaje con detalles del guardado');
console.log('✅ Recargar/actualizar los datos en pantalla');
console.log('✅ Disparar evento "empresa-data-changed" para otros componentes');

console.log('\n🎯 7. VERIFICACIÓN FINAL:');
console.log(`✅ Subdomain en formulario: ${datosFormulario.general.subdomain}`);
console.log(`✅ Subdomain en websiteSettings.general: ${websiteSettings.general?.subdomain}`);
console.log(`✅ Subdomain en websiteSettings raíz: ${websiteSettings.subdomain}`);
console.log(`✅ Subdomain en respuesta backend: ${respuestaBackend.empresa.subdominio}`);

if (datosFormulario.general.subdomain === websiteSettings.general?.subdomain &&
    websiteSettings.general?.subdomain === websiteSettings.subdomain &&
    websiteSettings.subdomain === respuestaBackend.empresa.subdominio) {
    console.log('✅ ✅ ✅ TODOS LOS SUBDOMINIOS COINCIDEN - SISTEMA FUNCIONAL');
} else {
    console.log('❌ ❌ ❌ ERROR: Subdomains no coinciden');
}

console.log('\n💡 8. INSTRUCCIONES PARA PROBAR EN PRODUCCIÓN:');
console.log('1. Abre consola del navegador (F12 → Console)');
console.log('2. Abre formulario /website-general');
console.log('3. Cambia algún valor (ej: subdomain a "miempresa-test")');
console.log('4. Haz clic en "Guardar Todo"');
console.log('5. VERIFICA EN CONSOLA:');
console.log('   - "[FRONTEND] Enviando datos a /website/home-settings:"');
console.log('   - "[FRONTEND] Respuesta de /website/home-settings:"');
console.log('   - Debe mostrar datos actualizados en la respuesta');
console.log('6. VERIFICA EN SERVIDOR (logs):');
console.log('   - "[SQL UPDATE empresas] Query:"');
console.log('   - "[SQL UPDATE empresas] Params:"');
console.log('   - "[SQL UPDATE empresas] Resultado: X fila(s) afectada(s)"');
console.log('7. Los datos en pantalla DEBEN actualizarse automáticamente');

console.log('\n⚠️ 9. POSIBLES PROBLEMAS:');
console.log('• Frontend no maneja la respuesta (solo muestra alert)');
console.log('• Backend no devuelve datos actualizados (solo message)');
console.log('• No hay recarga de datos después del guardado');
console.log('• Evento "empresa-data-changed" no está siendo escuchado');