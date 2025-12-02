const { createAppPackage } = require('../packager/createAppPackage');
const { exec } = require('child_process');
const path = require('path');

async function handlePremiumApp(empresaId, nombreEmpresa, logoUrl) {
    console.log(`⚙️ Generando paquete premium para empresa ${empresaId}...`);

    const manifest = createAppPackage(empresaId, nombreEmpresa, logoUrl);

    // Intento opcional de registro automático
    const scriptPath = path.join(__dirname, '..', 'registerAppAttempt.js');

    exec(`node "${scriptPath}" ${empresaId}`, (error, stdout, stderr) => {
        if (error) {
            console.error("❌ Error registrando App Premium:", error);
            return;
        }
        console.log(stdout);
        if (stderr) console.log(stderr);
    });

    return manifest;
}

module.exports = {
    handlePremiumApp
};
