const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error("⚠️  OPENAI_API_KEY no configurada - App Premium deshabilitada");
    console.log("💡 Para habilitar App Premium, agregar OPENAI_API_KEY al .env");
    // No salir con error, solo loguear y continuar
    process.exit(0); // Salir exitosamente sin hacer nada
}

// Tentative endpoint – verify in Apps SDK docs
const OPENAI_CREATE_APP_URL = "https://api.openai.com/v1/apps";

async function registerApp(manifest) {
    const res = await fetch(OPENAI_CREATE_APP_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: manifest.appName,
            description: manifest.description,
            logo: manifest.logo,
            mcp_url: manifest.mcpUrl || "https://TU_MCP_SERVER/mcp/capabilities",
            openapi: manifest.openapiUrl
        })
    });

    const json = await res.json();
    console.log("Respuesta OpenAI:", json);
    return json;
}

(async () => {
    const empresaId = process.argv[2];
    if (!empresaId) return console.error("Uso: node registerAppAttempt.js empresaId");

    const manifestPath = path.join(__dirname, '..', 'agentes', 'empresa', empresaId, 'app-package', 'manifest.json');
    if (!fs.existsSync(manifestPath)) return console.error("No existe manifest para", empresaId);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    await registerApp(manifest);
})();
