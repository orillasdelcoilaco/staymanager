/**
 * Simulación local de inventario verificado (Cabaña 9 u otra fixture en el archivo).
 * Ejecutar desde la raíz del repo: node scripts/legacy/simulate_ai_view.js
 */
const { getVerifiedInventory } = require('../../backend/services/propiedadLogicService');

// 1. Construimos la data estructurada de "Cabaña 9" tal como se guardaría en la BD
const cabana9 = {
    nombre: "Cabaña 9",
    componentes: [
        // --- DORMITORIOS ---
        {
            id: "dorm_1",
            nombre: "Dormitorio Principal (En Suite)",
            tipo: "DORMITORIO",
            elementos: [
                { nombre: "Cama Matrimonial", tipo: "CAMA", subTipo: "Matrimonial", cantidad: 1, countable: true, count_value: 2 }
            ]
        },
        {
            id: "dorm_2",
            nombre: "Dormitorio 2",
            tipo: "DORMITORIO",
            elementos: [
                { nombre: "Cama Matrimonial", tipo: "CAMA", subTipo: "Matrimonial", cantidad: 1, countable: true, count_value: 2 }
            ]
        },
        {
            id: "dorm_3",
            nombre: "Dormitorio 3",
            tipo: "DORMITORIO",
            elementos: [
                { nombre: "Cama Plaza y Media", tipo: "CAMA", subTipo: "1.5 Plaza", cantidad: 2, countable: true, count_value: 1.5 }
            ]
        },

        // --- BAÑOS ---
        {
            id: "bano_1",
            nombre: "Baño en Suite",
            tipo: "BANO",
            elementos: [
                { nombre: "Ducha", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true },
                { nombre: "WC", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true },
                { nombre: "Lavamanos", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true }
            ]
        },
        {
            id: "bano_2",
            nombre: "Baño Compartido",
            tipo: "BANO",
            elementos: [
                { nombre: "Tina", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true },
                { nombre: "WC", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true },
                { nombre: "Lavamanos", tipo: "BANO_ELEMENTO", cantidad: 1, countable: true }
            ]
        },

        // --- ÁREA COMÚN (Open Space) ---
        {
            id: "cocina",
            nombre: "Cocina Americana",
            tipo: "COCINA",
            elementos: [
                { nombre: "Cocina a Gas", tipo: "ELECTRO", cantidad: 1, countable: true },
                { nombre: "Refrigerador", tipo: "ELECTRO", cantidad: 1, countable: true },
                { nombre: "Microondas", tipo: "ELECTRO", cantidad: 1, countable: true },
                { nombre: "Juguera", tipo: "ELECTRO", cantidad: 1, countable: true },
                { nombre: "Lavaplatos", tipo: "GRIFERIA", cantidad: 1, countable: true },
                { nombre: "Ollas y Sartenes", tipo: "MENAJE", cantidad: 1, countable: false }, // No contable, solo presencia
                { nombre: "Servicio Completo (6 pax)", tipo: "MENAJE", cantidad: 1, countable: false }
            ]
        },
        {
            id: "comedor",
            nombre: "Comedor",
            tipo: "COMEDOR",
            elementos: [
                { nombre: "Mesa de Comedor (6 sillas)", tipo: "MUEBLE", cantidad: 1, countable: true }
            ]
        },
        {
            id: "living",
            nombre: "Living",
            tipo: "LIVING",
            elementos: [
                { nombre: "Sofá", tipo: "MUEBLE", cantidad: 1, countable: true },
                { nombre: "TV", tipo: "EQUIPAMIENTO", cantidad: 1, countable: true }
            ]
        },

        // --- EXTERIOR ---
        {
            id: "terraza",
            nombre: "Terraza Techada",
            tipo: "TERRAZA",
            elementos: [
                { nombre: "Juego de Terraza (6 sillas)", tipo: "MUEBLE", cantidad: 1, countable: true },
                { nombre: "Parrilla", tipo: "EQUIPAMIENTO", cantidad: 1, countable: true }
            ]
        },
        {
            id: "patio",
            nombre: "Patio Privado",
            tipo: "EXTERIOR",
            elementos: [
                { nombre: "Tinaja Caliente", tipo: "AMENIDAD_LUJO", subTipo: "TINAJA", cantidad: 1, countable: true },
                { nombre: "Estacionamiento", tipo: "GENERAL", cantidad: 1, countable: true }
            ]
        },

        // --- SERVICIOS ---
        {
            id: "servicios",
            nombre: "Servicios Generales",
            tipo: "GENERAL",
            elementos: [
                { nombre: "Wifi Starlink", tipo: "CONECTIVIDAD", cantidad: 1, countable: false }
            ]
        }
    ]
};

// 2. Simulamos la "Visión de la IA"
console.log("🤖 AI Agent: Analizando inventario de 'Cabaña 9'...");
const verifiedInventory = getVerifiedInventory(cabana9.componentes);

console.log(JSON.stringify(verifiedInventory, null, 2));

// 3. Simulación de preguntas de IA
console.log("\n--- 🧠 Simulación de Razonamiento IA ---");

const hasTinaja = verifiedInventory.some(i => i.description.toLowerCase().includes('tinaja'));
const bedCapacity = verifiedInventory.reduce((acc, i) => acc + (i.capacity_contribution || 0), 0);
const hasStarlink = verifiedInventory.some(i => i.description.toLowerCase().includes('starlink'));

console.log(`> ¿Tiene Tinaja?: ${hasTinaja ? "✅ SÍ (Verificado en Patio Privado)" : "❌ NO"}`);
console.log(`> Capacidad Real (Camas): ${bedCapacity} Pax`);
console.log(`> ¿Internet Satelital?: ${hasStarlink ? "✅ SÍ (Wifi Starlink detectado)" : "❌ NO"}`);
