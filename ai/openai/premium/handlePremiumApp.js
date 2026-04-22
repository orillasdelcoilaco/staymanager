const { createAppPackage } = require('../packager/createAppPackage');
const { exec } = require('child_process');
const path = require('path');

async function handlePremiumApp(empresaId, nombreEmpresa, logoUrl) {
    console.log(`⚙️ Generando paquete premium para empresa ${empresaId}...`);

    try {
        const manifest = createAppPackage(empresaId, nombreEmpresa, logoUrl);

        // Intento opcional de registro automático (en background)
        const scriptPath = path.join(__dirname, '..', 'registerAppAttempt.js');

        exec(`node "${scriptPath}" ${empresaId}`, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Error en registro de App Premium:", error.message);
                return;
            }
            if (stdout) console.log(stdout);
            if (stderr && !stderr.includes('OPENAI_API_KEY no configurada')) {
                console.error("⚠️  Advertencia en App Premium:", stderr);
            }
        });

        return manifest;
    } catch (error) {
        console.error("❌ Error generando paquete premium:", error.message);
        // Retornar null en lugar de fallar completamente
        return null;
    }
}

module.exports = {
    handlePremiumApp
};
