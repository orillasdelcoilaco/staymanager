/**
 * backend/scripts/test_logo_upload.js
 *
 * Script para probar la subida de logos y verificar que no hay errores
 * de módulos faltantes.
 */

const path = require('path');

console.log('=== PRUEBA DE MÓDULOS PARA SUBIDA DE LOGOS ===\n');

// 1. Verificar módulos básicos
console.log('1. VERIFICANDO MÓDULOS BÁSICOS:');
try {
    require('express');
    console.log('   ✅ express');
} catch (e) {
    console.log(`   ❌ express: ${e.message}`);
}

try {
    require('multer');
    console.log('   ✅ multer');
} catch (e) {
    console.log(`   ❌ multer: ${e.message}`);
}

try {
    require('sharp');
    console.log('   ✅ sharp');
} catch (e) {
    console.log(`   ❌ sharp: ${e.message}`);
}

// 2. Verificar módulos internos
console.log('\n2. VERIFICANDO MÓDULOS INTERNOS:');

try {
    require('../services/storageService');
    console.log('   ✅ storageService');
} catch (e) {
    console.log(`   ❌ storageService: ${e.message}`);
}

try {
    require('../services/empresaService');
    console.log('   ✅ empresaService');
} catch (e) {
    console.log(`   ❌ empresaService: ${e.message}`);
}

// 3. Verificar módulos de App Premium
console.log('\n3. VERIFICANDO MÓDULOS APP PREMIUM:');

try {
    const premiumPath = path.join(__dirname, '..', '..', 'ai', 'openai', 'premium', 'handlePremiumApp');
    require(premiumPath);
    console.log('   ✅ handlePremiumApp');
} catch (e) {
    console.log(`   ❌ handlePremiumApp: ${e.message}`);
    console.log('   ⚠️  Esto podría causar error en subida de logos');
}

try {
    const packagerPath = path.join(__dirname, '..', '..', 'ai', 'openai', 'packager', 'createAppPackage');
    require(packagerPath);
    console.log('   ✅ createAppPackage');
} catch (e) {
    console.log(`   ❌ createAppPackage: ${e.message}`);
}

try {
    const registerPath = path.join(__dirname, '..', '..', 'ai', 'openai', 'registerAppAttempt');
    require(registerPath);
    console.log('   ✅ registerAppAttempt');
} catch (e) {
    console.log(`   ❌ registerAppAttempt: ${e.message}`);
    console.log('   ⚠️  Esto podría fallar si falta node-fetch o OPENAI_API_KEY');
}

// 4. Verificar variables de entorno
console.log('\n4. VERIFICANDO VARIABLES DE ENTORNO:');

const envVars = [
    'OPENAI_API_KEY',
    'STORAGE_BUCKET',
    'GOOGLE_APPLICATION_CREDENTIALS'
];

envVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`   ✅ ${varName}: Configurada`);
    } else {
        console.log(`   ⚠️  ${varName}: No configurada`);
    }
});

// 5. Recomendaciones
console.log('\n5. RECOMENDACIONES:');

const recommendations = [];

// Verificar si node-fetch está instalado
try {
    require('node-fetch');
} catch (e) {
    recommendations.push('• Instalar node-fetch: npm install node-fetch');
}

// Verificar ruta de empresa.js
const empresaJsPath = path.join(__dirname, '..', 'routes', 'empresa.js');
try {
    require('fs').accessSync(empresaJsPath);
    console.log(`   ✅ empresa.js existe en: ${empresaJsPath}`);
} catch (e) {
    recommendations.push(`• Verificar que empresa.js existe en: ${empresaJsPath}`);
}

if (recommendations.length > 0) {
    console.log('   Se recomienda:');
    recommendations.forEach(rec => console.log(`   ${rec}`));
} else {
    console.log('   ✅ Todos los módulos básicos están disponibles');
}

console.log('\n=== INSTRUCCIONES PARA PROBAR ===');
console.log('1. Iniciar servidor:');
console.log('   cd backend && npm run dev');
console.log('\n2. Probar subida de logo en wizard paso 3');
console.log('\n3. Si hay error, revisar logs del servidor');
console.log('\n4. Posibles problemas comunes:');
console.log('   • Falta node-fetch: npm install node-fetch');
console.log('   • OPENAI_API_KEY no configurada en .env');
console.log('   • Permisos de Storage (Google Cloud)');

console.log('\n=== PRUEBA COMPLETADA ===');