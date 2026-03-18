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
const { actualizarPropiedad, crearPropiedad, obtenerPropiedadPorId } = require('../services/propiedadesService');

const EMPRESA_ID = 'test-empresa-debug';

async function testDoubleSave() {
    console.log("🚀 Testing Double Save Sequence...");

    let propId = null;

    try {
        // 1. Create Base Property (Empty)
        const propData = {
            nombre: "Propiedad DoubleSave " + uuidv4().slice(0, 5),
            capacidad: 0,
            componentes: []
        };
        const prop = await crearPropiedad(db, EMPRESA_ID, propData);
        propId = prop.id;
        console.log(`✅ [1] Property Created: ${propId}`);

        // 2. Add "Dormitorio" (First Save)
        console.log("👉 [2] Adding Dormitorio...");
        const payload1 = {
            ...prop, // mimic frontend spreading
            componentes: [
                {
                    id: "dorm-1",
                    nombre: "Dormitorio Principal",
                    tipo: "Dormitorio",
                    elementos: []
                }
            ]
        };
        await actualizarPropiedad(db, EMPRESA_ID, propId, payload1);

        // 3. Update Verification
        let check = await obtenerPropiedadPorId(db, EMPRESA_ID, propId);
        console.log(`🔍 [3] Check after 1st save: ${check.componentes.length} components.`);
        if (check.componentes.length !== 1) throw new Error("First save failed persistence");

        // 4. Add "Living" (Second Save - preserving Dormitorio)
        console.log("👉 [4] Adding Living (Merging with existing)...");
        const payload2 = {
            ...check, // mimic frontend using the loaded object
            componentes: [
                ...check.componentes,
                {
                    id: "living-1",
                    nombre: "Living Comedor",
                    tipo: "Living",
                    elementos: []
                }
            ]
        };

        // IMPORTANT: Frontend sends the FULL payload, replacing the old one.
        await actualizarPropiedad(db, EMPRESA_ID, propId, payload2);

        // 5. Final Verification
        const finalCheck = await obtenerPropiedadPorId(db, EMPRESA_ID, propId);
        console.log(`🔍 [5] Check after 2nd save: ${finalCheck.componentes.length} components.`);

        console.log("Items:", finalCheck.componentes.map(c => c.nombre));

        if (finalCheck.componentes.length === 2) {
            console.log("✅ SUCCESS: Both Dormitorio and Living persist.");
        } else {
            console.error("❌ FAILURE: Missing components!");
        }

        // Cleanup
        await db.collection('empresas').doc(EMPRESA_ID).collection('propiedades').doc(propId).delete();

    } catch (error) {
        console.error("❌ FAILURE:", error);
    }
}

testDoubleSave().then(() => process.exit(0));
