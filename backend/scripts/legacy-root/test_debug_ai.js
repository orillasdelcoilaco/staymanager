const tiposElementoService = require('../../services/tiposElementoService');
const aiContentService = require('../../services/aiContentService');

async function test() {
    console.log("Simulating Frontend Request for 'Microondas'...");
    const datosEntrada = {
        nombre: "Microondas",
        categoria: "", // Simulate Frontend sending empty category (Auto IA)
        force_creation: false
    };

    // Simulate Context Injection
    const categoriasDB = ["Baño"];
    const defaults = ['Dormitorio', 'Baño', 'Cocina', 'Estar', 'Exterior', 'Equipamiento', 'Tecnología'];
    const categoriasUnicas = [...new Set([...categoriasDB, ...defaults])];

    try {
        console.log("Calling AI Service...");
        const result = await aiContentService.analizarMetadataActivo(datosEntrada.nombre, categoriasUnicas);
        console.log("Final Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Test Error:", e);
    }
}

test();
