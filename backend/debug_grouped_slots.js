const path = require('path');
const { generarPlanFotos, hydrateInventory } = require(path.join(__dirname, 'services', 'propiedadLogicService'));

// 1. Mock Component Types (User Configuration)
const mockTipos = [
    {
        nombreNormalizado: "Cocina",
        shotList: ["Vista General", "Equipamiento"] // User wants 2 photos
    },
    {
        nombreNormalizado: "Dormitorio",
        shotList: ["Vista General"] // User wants 1 photo
    }
];

// 2. Mock Components (Property Data)
const mockComponents = [
    {
        id: "comp_cocina",
        nombre: "Cocina Americana",
        tipo: "COCINA",
        elementos: [
            { nombre: "Refrigerador", cantidad: 1, countable: false },
            { nombre: "Horno", cantidad: 1, countable: false },
            { nombre: "Lavaplatos", cantidad: 1, countable: false }
        ]
    },
    {
        id: "comp_dormitorio",
        nombre: "Dormitorio Principal",
        tipo: "DORMITORIO",
        elementos: [
            { nombre: "Cama King", cantidad: 1, countable: false },
            { nombre: "Velador", cantidad: 2, countable: false }
        ]
    }
];

console.log("🔍 Probando agrupación de slots...");

const plan = generarPlanFotos(mockComponents, mockTipos);

const fs = require('fs');
fs.writeFileSync('debug_output.json', JSON.stringify(plan, null, 2));
console.log("Plan written to debug_output.json");
console.log(JSON.stringify(plan, null, 2));

// Verificaciones
let passed = true;

// Check Cocina (Should have 2 slots)
const cocinaReqs = plan["comp_cocina"];
if (cocinaReqs.length === 2) {
    console.log("✅ Cocina tiene 2 slots (correcto)");
} else {
    console.log(`❌ Cocina tiene ${cocinaReqs.length} slots (esperado: 2)`);
    passed = false;
}

// Check Content in Slot 1 of Cocina
if (cocinaReqs[0].description.includes("Refrigerador") && cocinaReqs[0].description.includes("Horno")) {
    console.log("✅ Slot 1 de Cocina incluye requisitos de elementos");
} else {
    console.log("❌ Slot 1 de Cocina NO incluye requisitos de elementos");
    passed = false;
}

// Check Dormitorio (Should have 1 slot)
const dormReqs = plan["comp_dormitorio"];
if (dormReqs.length === 1) {
    console.log("✅ Dormitorio tiene 1 slot (correcto)");
} else {
    console.log(`❌ Dormitorio tiene ${dormReqs.length} slots (esperado: 1)`);
    passed = false;
}

if (dormReqs[0].description.includes("Cama") && dormReqs[0].description.includes("Velador")) {
    console.log("✅ Slot 1 de Dormitorio incluye requisitos de elementos");
} else {
    console.log("❌ Slot 1 de Dormitorio NO incluye requisitos de elementos");
    passed = false;
}

if (passed) console.log("\n🎉 TODAS LAS PRUEBAS DE AGRUPACIÓN PASARON");
else console.log("\n⚠️ ALGUNAS PRUEBAS FALLARON");
