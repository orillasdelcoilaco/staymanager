const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { v4: uuidv4 } = require('uuid');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Import Service directly
const { actualizarPropiedad, crearPropiedad } = require('../services/propiedadesService');
const { crearTipoComponente } = require('../services/componentesService');

const EMPRESA_ID = 'test-empresa-debug';

async function testPropertyUpdate() {
    console.log("🚀 Testing Property Update with New Component...");

    try {
        // 1. Create a Base Property
        const propData = {
            nombre: "Propiedad Test " + uuidv4().slice(0, 5),
            capacidad: 2,
            componentes: [
                {
                    id: "existing-room",
                    nombre: "Dormitorio Existente",
                    tipo: "Dormitorio",
                    elementos: []
                }
            ]
        };
        const prop = await crearPropiedad(db, EMPRESA_ID, propData);
        console.log(`✅ Base Property Created: ${prop.id}`);

        // 2. Simulate User Adding a "Nueva Terraza" in Frontend and Saving
        // The payload usually mimics the entire object state
        const updatePayload = {
            ...prop,
            componentes: [
                ...prop.componentes, // Keep existing
                {
                    // Newly added component (simulating frontend state)
                    id: "nuevo-dormitorio-" + Date.now(),
                    nombre: "Nuevo Dormitorio",
                    tipo: "Dormitorio",
                    icono: "🛏️",
                    elementos: [
                        { nombre: "Cama King", cantidad: 1, categoria: "MOBILIARIO", icono: "🛏️", permiteCantidad: true }
                    ]
                }
            ],
            // Ensure capacity updates if logic triggers
            capacidad: 4
        };

        console.log("payload sending...", JSON.stringify(updatePayload.componentes, null, 2));

        // 3. Call Update Service
        const updated = await actualizarPropiedad(db, EMPRESA_ID, prop.id, updatePayload);
        console.log("✅ Property Updated.");

        // 4. Verify Persistence (Read back from DB)
        const checkRef = db.collection('empresas').doc(EMPRESA_ID).collection('propiedades').doc(prop.id);
        const checkSnap = await checkRef.get();
        const checkData = checkSnap.data();

        // Check Subcollection too
        const subSnap = await checkRef.collection('componentes').get();
        console.log(`🔍 Verified Subcollection Count: ${subSnap.size} (Expected 2)`);

        if (subSnap.size === 2) {
            console.log("✅ SUCCESS: Both components persisted.");
        } else {
            console.error("❌ FAILURE: Components lost!", subSnap.docs.map(d => d.data()));
        }

        // Cleanup
        await checkRef.delete();

    } catch (error) {
        console.error("❌ FAILURE:", error);
    }
}

testPropertyUpdate().then(() => process.exit(0));
