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

const EMPRESA_ID = 'test-empresa-debug';

async function reproCrash() {
    console.log("🚀 Attempting to Reproduce Crash on Save...");

    try {
        // 1. Create Base Property
        const propData = {
            nombre: "Propiedad Crash Test " + uuidv4().slice(0, 5),
            capacidad: 2,
            componentes: []
        };
        const prop = await crearPropiedad(db, EMPRESA_ID, propData);
        console.log(`✅ Base Created: ${prop.id}`);

        // 2. Simulate Payload with Missing ID to trigger generarIdComponente
        const updatePayload = {
            ...prop,
            componentes: [
                {
                    // ID MISSING -> Should trigger generation
                    nombre: "Living Sin ID",
                    tipo: "Living",
                    elementos: []
                }
            ]
        };

        console.log("payload sending...", JSON.stringify(updatePayload.componentes, null, 2));

        // 3. Call Update Service
        const updated = await actualizarPropiedad(db, EMPRESA_ID, prop.id, updatePayload);
        console.log("✅ Property Updated Successfully (No Crash). New Component ID:", updated.componentes[0].id);

        // Cleanup
        await db.collection('empresas').doc(EMPRESA_ID).collection('propiedades').doc(prop.id).delete();

    } catch (error) {
        console.error("❌ CRASH CAUGHT:", error);
    }
}

reproCrash().then(() => process.exit(0));
