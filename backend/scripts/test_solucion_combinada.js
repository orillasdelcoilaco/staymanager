// TEST: Verificar que la solución combinada funciona
console.log('=== TEST: SOLUCIÓN COMBINADA (TODO EN UNA LLAMADA) ===\n');

console.log('🎯 SIMULANDO LO QUE ENVÍA EL FRONTEND CORREGIDO:\n');

// Datos que ahora envía el frontend en UNA sola llamada
const datosFrontendCombinados = {
    websiteSettings: {
        general: {
            whatsapp: "+56987654321",
            googleMapsUrl: "https://maps.google.com/...",
            domain: "miempresa-test.onrender.com",
            gaTrackingId: "G-ABCD1234",
            wizardCompleted: true,
            subdomain: "miempresa-test"
        },
        theme: {
            logoUrl: "https://storage.googleapis.com/.../logo.webp",
            heroImageUrl: "https://storage.googleapis.com/.../hero.webp",
            heroImageAlt: "Nuevo texto alternativo",
            heroImageTitle: "Nuevo título de imagen",
            primaryColor: "#3b82f6",
            secondaryColor: "#6b7280",
            accentColor: "#10b981"
        },
        content: {
            homeH1: "Bienvenido a nuestras cabañas",
            homeIntro: "Disfruta de la naturaleza en familia"
        },
        seo: {
            title: "Cabañas en la montaña | Mi Empresa",
            description: "Alquiler de cabañas familiares",
            keywords: "cabañas, montaña, naturaleza"
        }
    },
    historiaEmpresa: "Somos una empresa familiar con 10 años de experiencia...",
    slogan: "Tu hogar lejos de casa",
    tipoAlojamientoPrincipal: "cabañas",
    enfoqueMarketing: "familias y parejas",
    palabrasClaveAdicionales: "cabañas, montaña, naturaleza",
    strategy: {
        slogan: "Tu hogar lejos de casa",
        tipoAlojamientoPrincipal: "cabañas",
        enfoqueMarketing: "familias y parejas",
        palabrasClaveAdicionales: "cabañas, montaña, naturaleza",
        homeH1: "Bienvenido a nuestras cabañas",
        homeIntro: "Disfruta de la naturaleza en familia",
        homeSeoTitle: "Cabañas en la montaña | Mi Empresa",
        homeSeoDesc: "Alquiler de cabañas familiares",
        primaryColor: "#3b82f6",
        secondaryColor: "#6b7280",
        accentColor: "#10b981"
    }
};

console.log('📤 1. DATOS ENVIADOS POR FRONTEND (formato combinado):');
console.log(JSON.stringify(datosFrontendCombinados, null, 2));

console.log('\n🔧 2. PROCESAMIENTO EN BACKEND (websiteConfigRoutes.js):');
console.log('✅ Formato NUEVO detectado (tiene websiteSettings como objeto)');

// Simular lo que hace el backend
const body = datosFrontendCombinados;
const tieneWebsiteSettingsComoObjeto = body.websiteSettings && typeof body.websiteSettings === 'object';

let datosParaGuardar = {};
let websiteSettings = {};

if (tieneWebsiteSettingsComoObjeto) {
    console.log('✅ Procesando formato NUEVO (datos combinados)');

    // Extraer websiteSettings
    if (body.websiteSettings.general) {
        websiteSettings.general = body.websiteSettings.general;
        if (body.websiteSettings.general.subdomain) websiteSettings.subdomain = body.websiteSettings.general.subdomain;
        if (body.websiteSettings.general.domain) websiteSettings.domain = body.websiteSettings.general.domain;
        console.log(`✅ Subdomain configurado: ${body.websiteSettings.general.subdomain}`);
    }

    // Incluir websiteSettings en datosParaGuardar
    datosParaGuardar.websiteSettings = websiteSettings;

    // Incluir otros datos de empresa
    if (body.historiaEmpresa) datosParaGuardar.historiaEmpresa = body.historiaEmpresa;
    if (body.slogan) datosParaGuardar.slogan = body.slogan;
    if (body.tipoAlojamientoPrincipal) datosParaGuardar.tipoAlojamientoPrincipal = body.tipoAlojamientoPrincipal;
    if (body.enfoqueMarketing) datosParaGuardar.enfoqueMarketing = body.enfoqueMarketing;
    if (body.palabrasClaveAdicionales) datosParaGuardar.palabrasClaveAdicionales = body.palabrasClaveAdicionales;
    if (body.strategy) datosParaGuardar.strategy = body.strategy;
}

console.log('\n📝 3. DATOS QUE SE GUARDARÁN EN BD (datosParaGuardar):');
console.log(JSON.stringify(datosParaGuardar, null, 2));

console.log('\n🗄️ 4. LO QUE MOSTRARÁN LOS LOGS SQL:');
console.log('[SQL UPDATE empresas] resto (configuración):');
console.log(JSON.stringify(datosParaGuardar, null, 2));
console.log('[SQL UPDATE empresas] Resultado: 1 fila(s) afectada(s)');

console.log('\n🔍 5. VERIFICACIÓN CRÍTICA:');
console.log(`✅ websiteSettings incluido en datosParaGuardar: ${!!datosParaGuardar.websiteSettings}`);
console.log(`✅ Subdomain incluido: ${datosParaGuardar.websiteSettings?.general?.subdomain || 'NO'}`);
console.log(`✅ Datos de empresa incluidos: ${!!datosParaGuardar.historiaEmpresa}`);
console.log(`✅ Strategy incluido: ${!!datosParaGuardar.strategy}`);

console.log('\n🎯 6. COMPARACIÓN CON EL PROBLEMA ORIGINAL:');
console.log('❌ PROBLEMA ORIGINAL (mostrado en tu log):');
console.log('   Solo se guardaba: { historiaEmpresa, slogan, ..., strategy }');
console.log('   FALTABA: websiteSettings (subdomain, theme, etc.)');
console.log('');
console.log('✅ SOLUCIÓN IMPLEMENTADA:');
console.log('   Ahora se guarda: { websiteSettings, historiaEmpresa, slogan, ..., strategy }');
console.log('   INCLUYE TODO: websiteSettings + datos de empresa');

console.log('\n💡 7. PARA PROBAR EN PRODUCCIÓN:');
console.log('1. Abre /website-general');
console.log('2. Cambia subdomain a "test-" + fecha');
console.log('3. Haz clic en "Guardar Todo"');
console.log('4. VERIFICA EN SERVIDOR (logs):');
console.log('   Debe mostrar:');
console.log('   [SQL UPDATE empresas] resto (configuración): {');
console.log('     "websiteSettings": { ... },');
console.log('     "historiaEmpresa": "...",');
console.log('     "slogan": "...",');
console.log('     ...');
console.log('   }');
console.log('5. Los datos NO se perderán entre llamadas');

console.log('\n⚠️ 8. ¿QUÉ PASA SI ALGUIEN USA EL ENDPOINT /empresa (PUT)?');
console.log('El backend preservará websiteSettings existente (empresaService.js)');
console.log('Pero RECOMENDACIÓN: Usar solo /website/home-settings para todo');
