const { generarPropuestaDeEspacioAsync } = require('../../services/logicaEspacios');

async function testIntegration() {
    console.log("--- TESTING AI INTEGRATION ---");
    const input = {
        tipo: "Master Suite",
        activos: ["King Bed", "Walking Closet", "Jacuzzi"],
        detalles: "Vista al mar"
    };

    try {
        const result = await generarPropuestaDeEspacioAsync(input.tipo, input.activos, input.detalles);

        console.log("H1:", result.seo.h1);
        console.log("Prompt Exists:", !!result.promptFotos);
        console.log("Requerimientos Fotos (AI Result):", JSON.stringify(result.requerimientosFotos, null, 2));

        if (result.requerimientosFotos.length > 0 && result.requerimientosFotos[0].motivo_relevancia.includes("Simulado")) {
            console.log("SUCCESS: Simulation was triggered and result injected.");
        } else if (result.requerimientosFotos.length > 0) {
            console.log("SUCCESS: Real AI response received.");
        } else {
            console.log("FAIL: Empty requirements returned.");
            process.exit(1);
        }

    } catch (error) {
        console.error("FAIL: Error executing async function:", error);
        process.exit(1);
    }
}

testIntegration();
