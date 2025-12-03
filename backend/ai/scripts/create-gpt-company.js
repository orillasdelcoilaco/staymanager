const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Inicializar Firebase Admin si no está inicializado (para scripts independientes)
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../../serviceAccountKey.json'); // Ajustar ruta según ubicación real
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.warn("No se pudo inicializar Firebase con serviceAccountKey local. Asegúrate de configurar las credenciales.");
    }
}

const db = admin.firestore();

async function generateCompanyGPT(empresaId) {
    try {
        console.log(`Generando GPT para empresa: ${empresaId}...`);

        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        if (!empresaDoc.exists) {
            console.error(`Empresa ${empresaId} no encontrada.`);
            return;
        }

        const data = empresaDoc.data();
        const isPremium = data.plan === 'premium';

        const outputDir = path.join(__dirname, `../gpts/${empresaId}`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 1. Config JSON
        const config = {
            empresaId: empresaId,
            nombre: data.nombreFantasia || data.razonSocial,
            plan: data.plan || 'free',
            generatedAt: new Date().toISOString(),
            actionsUrl: "https://suite-manager.onrender.com/openapi-chatgpt.yaml"
        };

        fs.writeFileSync(path.join(outputDir, 'config.json'), JSON.stringify(config, null, 2));

        // 2. Instructions MD
        let instructions = `# Asistente IA para ${config.nombre}\n\n`;

        if (isPremium) {
            instructions += `Eres el asistente oficial y exclusivo de ${config.nombre}.\n`;
            instructions += `Tu tono debe ser: ${data.branding?.tono || 'Profesional y amable'}.\n`;
            instructions += `Usa la información de contacto: ${data.emailContacto || ''}.\n\n`;
            instructions += `## Reglas\n`;
            instructions += `- Solo ofrece alojamientos de esta empresa (${empresaId}).\n`;
            instructions += `- Si te preguntan por otras empresas, indica que solo gestionas reservas para ${config.nombre}.\n`;
        } else {
            instructions += `Eres un asistente de reservas que opera en el marketplace de SuiteManager.\n`;
            instructions += `Actualmente estás atendiendo consultas para ${config.nombre}, pero puedes ofrecer alternativas si no hay disponibilidad.\n`;
        }

        instructions += `\n## Herramientas\n`;
        instructions += `- Usa 'consultarDisponibilidad' con empresa_id='${empresaId}' para ver fechas libres.\n`;
        instructions += `- Usa 'crearReserva' para confirmar bookings.\n`;
        instructions += `- Usa 'obtenerDetalleAlojamiento' para dar información específica.\n`;

        fs.writeFileSync(path.join(outputDir, 'instructions.md'), instructions);

        // 3. Branding (Solo Premium)
        if (isPremium) {
            const brandingDir = path.join(outputDir, 'branding');
            if (!fs.existsSync(brandingDir)) {
                fs.mkdirSync(brandingDir);
            }
            // Aquí se descargarían logos, etc.
            console.log(`[PREMIUM] Branding assets placeholder created for ${empresaId}`);
        }

        console.log(`✅ GPT generado exitosamente en: ${outputDir}`);

    } catch (error) {
        console.error(`Error generando GPT para ${empresaId}:`, error);
    }
}

// Si se ejecuta directamente: node create-gpt-company.js <empresaId>
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length > 0) {
        generateCompanyGPT(args[0]);
    } else {
        console.log("Uso: node create-gpt-company.js <empresaId>");
    }
}

module.exports = { generateCompanyGPT };
