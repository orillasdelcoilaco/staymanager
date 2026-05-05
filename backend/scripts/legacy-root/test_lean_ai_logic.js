const { generarPropuestaDeEspacio } = require('../../services/logicaEspacios');

const tipo = "Kitchen";
const activos = ["Hervidor", "Tostadora", "Refrigerador Side-by-Side", "Horno de barro"];

const resultado = generarPropuestaDeEspacio(tipo, activos, "Cocina full equipada");

console.log("=== PROMPT GENERADO ===");
console.log(resultado.promptFotos);
console.log("=======================");

if (resultado.promptFotos.includes("ELEMENTOS FUNCIONALES (Trust/Validación) -> REQUIEREN FOTO DE CONTEXTO")) {
    console.log("✅ TEST PASSED: El prompt contiene la lógica de agrupación.");
} else {
    console.error("❌ TEST FAILED: El prompt NO contiene la nueva lógica.");
}
