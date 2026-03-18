const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { v4: uuidv4 } = require('uuid');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Mock User Context
const mockUser = { empresaId: 'test-empresa-debug' };

// Import Service Functions manually to replicate Route logic
// We can't import the route handler easily, so we copy the logic flow from routes/componentes.js
const { crearTipoComponente } = require('../services/componentesService');
const { crearTipo: crearTipoElemento, buscarTipoFuzzy } = require('../services/tiposElementoService');

async function simulateSave() {
    console.log("🚀 Simulating Space Save...");

    // 1. Simulate Payload from Frontend
    const reqBody = {
        nombreUsuario: "Terraza de Prueba Script",
        nombreNormalizado: "Terraza",
        descripcionBase: "Espacio de prueba",
        shotList: ["Foto 1"],
        icono: "🏞️",
        inventarioSugerido: [
            { nombre: "Parrilla Super Nueva " + uuidv4().slice(0, 5), cantidad: 1, categoria: "EQUIPAMIENTO" } // NEW ITEM
        ],
        elementosDefault: [] // Assume no existing items for simplicity, or we can fetch one if needed
    };

    try {
        // --- LOGIC FROM POST /componentes ---

        const elementosVinculados = [];

        // Step 1: Process Inventario Sugerido
        if (reqBody.inventarioSugerido && Array.isArray(reqBody.inventarioSugerido)) {
            console.log(`[Logic] Processing ${reqBody.inventarioSugerido.length} suggested items...`);

            for (const item of reqBody.inventarioSugerido) {
                const nombreItem = (item.nombre || '').trim();
                if (!nombreItem) continue;

                // Fuzzy Search
                let tipoElemento = await buscarTipoFuzzy(db, mockUser.empresaId, nombreItem);

                if (!tipoElemento) {
                    console.log(`[Logic] Item '${nombreItem}' not found. Creating new...`);
                    const nuevo = await crearTipoElemento(db, mockUser.empresaId, {
                        nombre: nombreItem,
                        categoria: item.categoria || 'EQUIPAMIENTO',
                        icono: '🆕',
                        permiteCantidad: true
                    });
                    tipoElemento = nuevo;
                    console.log(`[Logic] Created ID: ${nuevo.id}`);
                } else {
                    console.log(`[Logic] Found existing: ${tipoElemento.id}`);
                }

                if (tipoElemento && tipoElemento.id) {
                    elementosVinculados.push({
                        tipoId: tipoElemento.id,
                        nombre: tipoElemento.nombre,
                        icono: tipoElemento.icono,
                        cantidad: item.cantidad || 1
                    });
                }
            }
        }

        // Step 2: Merge defaults
        const defaultsUsuario = Array.isArray(reqBody.elementosDefault) ? reqBody.elementosDefault : [];
        const mapDefaults = new Map();
        defaultsUsuario.forEach(d => mapDefaults.set(d.tipoId, d));
        elementosVinculados.forEach(d => {
            if (!mapDefaults.has(d.tipoId)) {
                mapDefaults.set(d.tipoId, d);
            }
        });

        const payloadFinal = {
            ...reqBody,
            elementosDefault: Array.from(mapDefaults.values())
        };

        console.log("[Logic] Payload Final for crearTipoComponente:", JSON.stringify(payloadFinal, null, 2));

        // Step 3: Create Component
        const nuevoTipo = await crearTipoComponente(db, mockUser.empresaId, payloadFinal);
        console.log("✅ SUCCESS! Created Component:", nuevoTipo.id);

    } catch (error) {
        console.error("❌ FAILURE:", error);
    }
}

simulateSave().then(() => process.exit(0));
