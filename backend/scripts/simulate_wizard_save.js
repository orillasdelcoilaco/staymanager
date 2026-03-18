const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { v4: uuidv4 } = require('uuid');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Import Service / Route Logic simulation
const { crearTipoComponente } = require('../services/componentesService');
const { buscarTipoFuzzy, crearTipo: crearTipoElemento } = require('../services/tiposElementoService');

const EMPRESA_ID = 'test-empresa-debug';

async function simulateWizardSave() {
    console.log("🚀 Simulating Wizard Save (User Workflow: Delete New, Add Existing)...");

    try {
        // SCENARIO: 
        // 1. User gets suggestions. 
        // 2. User deletes ALL "New" suggestions (so inventarioSugerido overrides to [] or similar).
        // 3. User adds an Existing item (Mesa de Centro).

        const payloadFromFrontend = {
            nombreUsuario: "Living User Workflow " + uuidv4().slice(0, 5),
            nombreNormalizado: "Living Test",
            descripcionBase: "Living de prueba con workflow de usuario",
            shotList: ["Foto 1"],
            icono: "🛋️",

            // User deleted all new items, so this is empty
            inventarioSugerido: [],

            // User added one existing item manually
            elementosDefault: [
                {
                    tipoId: "existing-item-id-mock", // We need a real ID if we were doing deep validation, but service might just store it
                    nombre: "Mesa de Centro Agregada",
                    icono: "🪵",
                    cantidad: 1,
                    isNew: false
                }
            ]
        };

        console.log("Payload:", JSON.stringify(payloadFromFrontend, null, 2));

        // --- Route Logic Simulation (backend/routes/componentes.js) ---

        const elementosVinculados = [];

        // 1. Process Inventario Sugerido (Empty in this case)
        if (payloadFromFrontend.inventarioSugerido && Array.isArray(payloadFromFrontend.inventarioSugerido)) {
            for (const item of payloadFromFrontend.inventarioSugerido) {
                // Should skip
                console.log("Processing suggested item...", item);
            }
        }

        // 2. Merge Defaults
        const defaultsUsuario = Array.isArray(payloadFromFrontend.elementosDefault) ? payloadFromFrontend.elementosDefault : [];
        const mapDefaults = new Map();

        // Add user defaults
        defaultsUsuario.forEach(d => mapDefaults.set(d.tipoId || d.nombre, d));

        // Add linked AI items (none)
        elementosVinculados.forEach(d => {
            if (!mapDefaults.has(d.tipoId)) {
                mapDefaults.set(d.tipoId, d);
            }
        });

        const payloadFinal = {
            ...payloadFromFrontend,
            elementosDefault: Array.from(mapDefaults.values())
        };

        console.log("Payload Final to Service:", JSON.stringify(payloadFinal, null, 2));

        // 3. Call Service
        const nuevoTipo = await crearTipoComponente(db, EMPRESA_ID, payloadFinal);
        console.log(`✅ SUCCESS: Component Created with ID: ${nuevoTipo.id}`);

        // Cleanup
        await db.collection('empresas').doc(EMPRESA_ID).collection('tiposComponente').doc(nuevoTipo.id).delete();

    } catch (error) {
        console.error("❌ FAILURE:", error);
    }
}

simulateWizardSave().then(() => process.exit(0));
