const fs = require('fs');
const path = require('path');

function createAppPackage(empresaId, nombreEmpresa, logoUrl) {
    const outDir = path.join(__dirname, '..', '..', 'agentes', 'empresa', empresaId, 'app-package');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const manifest = {
        appName: `${nombreEmpresa} — Reservas`,
        empresaId,
        description: `App oficial de reservas para ${nombreEmpresa} usando SuiteManager.`,
        logo: logoUrl || '',
        openapiUrl: `https://TU_DOMINIO/openapi/${empresaId}.openapi.json`,
        createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(outDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    return manifest;
}

module.exports = { createAppPackage };
