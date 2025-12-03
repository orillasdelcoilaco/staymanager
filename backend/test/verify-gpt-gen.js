const createCompanyGPT = require('../ai/scripts/create-company-gpt');
const fs = require('fs');
const path = require('path');

const testEmpresa = {
    id: 'empresa-test-verification',
    nombre: 'Empresa de Prueba Verificación',
    plan: 'premium'
};

console.log('--- Iniciando Prueba de Generación de GPT ---');

try {
    // 1. Ejecutar la función
    createCompanyGPT(testEmpresa);

    // 2. Verificar archivos
    const targetDir = path.join(__dirname, '../ai/gpts', testEmpresa.id);
    const manifestPath = path.join(targetDir, 'manifest.json');
    const instructionsPath = path.join(targetDir, 'instructions.md');
    const brandingDir = path.join(targetDir, 'branding');

    if (fs.existsSync(manifestPath) && fs.existsSync(instructionsPath) && fs.existsSync(brandingDir)) {
        console.log('✅ Archivos generados correctamente.');

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.name === 'Empresa de Prueba Verificación — Asistente IA') {
            console.log('✅ Manifest contiene el nombre correcto.');
        } else {
            console.error('❌ Nombre en manifest incorrecto:', manifest.name);
        }

    } else {
        console.error('❌ Faltan archivos o directorios.');
        console.log('Manifest:', fs.existsSync(manifestPath));
        console.log('Instructions:', fs.existsSync(instructionsPath));
        console.log('Branding:', fs.existsSync(brandingDir));
    }

    // Limpieza (opcional, dejarlo para inspección manual si falla)
    // fs.rmSync(targetDir, { recursive: true, force: true });

} catch (error) {
    console.error('❌ Error durante la prueba:', error);
}
