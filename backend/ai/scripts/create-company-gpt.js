const fs = require("fs");
const path = require("path");

module.exports = function createCompanyGPT(empresa) {
    try {
        const folder = path.join(__dirname, `../gpts/${empresa.id}`);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        const brandingFolder = path.join(folder, "branding");
        if (!fs.existsSync(brandingFolder)) {
            fs.mkdirSync(brandingFolder, { recursive: true });
        }

        // instrucciones personalizadas
        const instructions = `
Eres el asistente oficial de ${empresa.nombre}.
Responde con tono cálido y profesional.
Usa siempre las Actions de SuiteManager.
No inventes datos.
      `;

        fs.writeFileSync(path.join(folder, "instructions.md"), instructions);

        const manifest = {
            name: `${empresa.nombre} — Asistente IA`,
            description: `Concierge virtual de ${empresa.nombre}`,
            visibility: "public",
            logo: `branding/logo.png`,
            banner: `branding/banner.png`,
            actions: {
                openapi_url: "https://suite-manager.onrender.com/openapi-chatgpt.yaml"
            }
        };

        fs.writeFileSync(
            path.join(folder, "manifest.json"),
            JSON.stringify(manifest, null, 2)
        );

        console.log(`✅ GPT Premium generado para: ${empresa.nombre}`);
    } catch (error) {
        console.error(`Error generando GPT para ${empresa.id}:`, error);
    }
};
