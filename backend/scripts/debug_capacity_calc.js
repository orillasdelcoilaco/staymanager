// backend/scripts/debug_capacity_calc.js
const { calcularCapacidad } = require('../services/propiedadLogicService');

console.log("🚀 Testing Capacity Calculation Logic...");

// SCENARIO FROM USER:
// 1. "Dormitorio Principal" with "Cama 2 plazas" (standard: cap 2) -> EXPECT 2
// 2. "Otro Dormitorio" with "Camarote" (standard: cap 2) and "Cama Nido" (standard: cap 2) -> EXPECT 4
// TOTAL EXPECTED: 6 (User said 5, maybe Cama Nido is 1 in their mind/db, but standard is 2. Wait, user said total 5. 2 + 2 + 1 = 5. So check standard for Nido too).

// Simulation 1: Elements have 'capacity' property SET correctly.
const scenarioCorrect = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 }
        ]
    },
    {
        nombre: "Otro Dormitorio",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 2 },
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 } // Simulating user expectation of 1
        ]
    }
];

const totalCorrect = calcularCapacidad(scenarioCorrect);
console.log(`✅ Scenario with Explicit Capacity: ${totalCorrect} (Expected ~5 or 6)`);


// Simulation 2: Elements MISSING 'capacity' property (Frontend Bug Hypothesis).
const scenarioMissing = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1 } // MISSING capacity
        ]
    },
    {
        nombre: "Otro Dormitorio",
        elementos: [
            { nombre: "Camarote", cantidad: 1 }, // MISSING capacity
            { nombre: "Cama Nido", cantidad: 1 } // MISSING capacity
        ]
    }
];

const totalMissing = calcularCapacidad(scenarioMissing);
console.log(`❌ Scenario MISSING Capacity: ${totalMissing} (Expected 0)`);


// Simulation 3: Trying to find why user sees "3".
// User saw 3. 
// Maybe "Cama 2 plazas" worked (2) + "Cama Nido" worked (1) = 3? And Camarote failed?
// Or maybe "Cama 2 plazas" (2) + "Camarote" (1 only?) = 3?
// Or maybe "Cama 2 plazas" (2) + "Camarote" (0) + "Cama Nido" (1) = 3?

const scenarioPartial = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 } // works
        ]
    },
    {
        nombre: "Otro Dormitorio",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 0 }, // maybe 0 in DB?
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 } // maybe 1?
        ]
    }
];

const totalPartial = calcularCapacidad(scenarioPartial);
console.log(`❓ Scenario Partial: ${totalPartial}`);
