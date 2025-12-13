require('dotenv').config();
const aiService = require('./services/aiContentService');

async function test() {
    console.log("📡 Probando conexión con Gemini Provider...");
    const fakeCategories = ["Dormitorio", "Baño"];

    // Prueba 1: Algo estándar
    console.log("\n🧪 Analizando 'Cama King'...");
    try {
        const result1 = await aiService.analizarMetadataActivo("Cama King", fakeCategories);
        console.log("Resultado 1:", JSON.stringify(result1, null, 2));
    } catch (e) {
        console.error("Test 1 Failed:", e);
    }

    // Prueba 2: Algo nuevo
    console.log("\n🧪 Analizando 'Pista de Aterrizaje de OVNIs'...");
    try {
        const result2 = await aiService.analizarMetadataActivo("Pista de Aterrizaje de OVNIs", fakeCategories);
        console.log("Resultado 2:", JSON.stringify(result2, null, 2));
    } catch (e) {
        console.error("Test 2 Failed:", e);
    }
}

test();
