const path = require('path');

// Manually load dotenv as in the service
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const { generarDescripcionAlojamiento } = require('../../services/aiContentService');

async function test() {
    console.log("--- INICIANDO TEST DE AI SERVICE ---");
    console.log("API KEY (masked):", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + "..." : "NO ENCONTRADA");

    try {
        console.log("Llamando a generarDescripcionAlojamiento...");
        const result = await generarDescripcionAlojamiento(
            "Hermosa cabaña frente al lago con tinaja caliente.", // Desc
            "Cabaña El Roble", // Nombre Prop
            "Turismo Sur", // Empresa
            "Villarrica, Chile", // Ubicación
            "Cabaña", // Tipo
            "Relax", // Marketing
            {
                historia: "Empresa familiar con 20 años de experiencia.",
                slogan: "Descanso natural",
                palabrasClave: "tinaja, bosque, lago"
            }
        );

        console.log("\n--- RESULTADO OBTENIDO ---");
        console.log(result);

        if (typeof result === 'string' && result.includes('[Nota: Error')) {
            console.error("\n❌ FALLO: Se recibió el mensaje de error del fallback.");
        } else if (result.includes("Contenido generado automáticamente")) {
            console.error("\n❌ FALLO: Se recibió el mensaje genérico de fallback.");
        } else {
            console.log("\n✅ ÉXITO: La IA generó contenido real.");
        }

    } catch (e) {
        console.error("\n❌ EXCEPCIÓN NO CONTROLADA:", e);
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, 'last_error.log'), `ERROR: ${e.message}\nSTACK: ${e.stack}\nFULL: ${JSON.stringify(e, null, 2)}`);
    }
}

test();
