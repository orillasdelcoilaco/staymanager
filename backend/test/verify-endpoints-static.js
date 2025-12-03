const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // Necesitaremos instalar esto o usar una validación simple si no está
// Como no puedo instalar paquetes, haré validación básica de parsing.

console.log('--- Iniciando Verificación de OpenAPI y Endpoints ---');

// 1. Validar OpenAPI ChatGPT (YAML)
try {
    const chatgptPath = path.join(__dirname, '../openapi/openapi-chatgpt.yaml');
    const content = fs.readFileSync(chatgptPath, 'utf8');
    // Validación simple: debe contener "openapi: 3.1.0" y paths
    if (content.includes('openapi: 3.1.0') && content.includes('/ai/busqueda-general')) {
        console.log('✅ openapi-chatgpt.yaml parece válido y contiene los nuevos endpoints.');
    } else {
        console.error('❌ openapi-chatgpt.yaml no parece válido o le faltan endpoints.');
    }
} catch (e) {
    console.error('❌ Error leyendo openapi-chatgpt.yaml:', e.message);
}

// 2. Validar OpenAPI Gemini (YAML)
try {
    const geminiPath = path.join(__dirname, '../openapi/openapi-gemini.yaml');
    const content = fs.readFileSync(geminiPath, 'utf8');
    if (content.includes('openapi: 3.1.0') && content.includes('SuiteManager Public API for Gemini')) {
        console.log('✅ openapi-gemini.yaml parece válido.');
    } else {
        console.error('❌ openapi-gemini.yaml no parece válido.');
    }
} catch (e) {
    console.error('❌ Error leyendo openapi-gemini.yaml:', e.message);
}

// 3. Validar Claude Tools (JSON)
try {
    const claudePath = path.join(__dirname, '../openapi/claude-tools.json');
    const content = fs.readFileSync(claudePath, 'utf8');
    const json = JSON.parse(content);
    if (Array.isArray(json) && json.find(t => t.name === 'busqueda_general')) {
        console.log('✅ claude-tools.json es un JSON válido y contiene busqueda_general.');
    } else {
        console.error('❌ claude-tools.json no tiene el formato esperado.');
    }
} catch (e) {
    console.error('❌ Error leyendo/parseando claude-tools.json:', e.message);
}

// 4. Verificar existencia de ia.js y empresas.json
const iaRoutePath = path.join(__dirname, '../routes/ia.js');
const empresasPath = path.join(__dirname, '../ai/router/empresas.json');

if (fs.existsSync(iaRoutePath)) console.log('✅ backend/routes/ia.js existe.');
else console.error('❌ backend/routes/ia.js NO existe.');

if (fs.existsSync(empresasPath)) {
    console.log('✅ backend/ai/router/empresas.json existe.');
    try {
        const empresas = JSON.parse(fs.readFileSync(empresasPath, 'utf8'));
        if (Array.isArray(empresas) && empresas.length > 0) {
            console.log(`✅ empresas.json contiene ${empresas.length} empresa(s).`);
        } else {
            console.warn('⚠️ empresas.json existe pero está vacío o no es un array.');
        }
    } catch (e) {
        console.error('❌ Error parseando empresas.json:', e.message);
    }
} else {
    console.error('❌ backend/ai/router/empresas.json NO existe.');
}
