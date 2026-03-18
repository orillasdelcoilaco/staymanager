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
const { crearTipoComponente } = require('../services/componentesService');

const EMPRESA_ID = 'test-empresa-debug';

async function testTypeCreation() {
    console.log("🚀 Testing Type Creation...");

    try {
        const uniqueName = "Living Test " + uuidv4().slice(0, 5);

        // 1. Create Type
        const newType = await crearTipoComponente(db, EMPRESA_ID, {
            nombreNormalizado: uniqueName,
            icono: "🛋️",
            descripcionBase: "Living de prueba",
            shotList: [],
            inventarioSugerido: [],
            elementosDefault: []
        });
        console.log(`✅ Type Created: ${newType.id} (${newType.nombreNormalizado})`);

        // 2. Fetch List
        const snapshot = await db.collection('empresas').doc(EMPRESA_ID).collection('tiposComponente').get();
        const types = snapshot.docs.map(d => d.data());
        console.log(`🔍 Total Types: ${types.length}`);

        const found = types.find(t => t.nombreNormalizado === uniqueName);
        if (found) {
            console.log("✅ SUCCESS: Type found in list.");
        } else {
            console.error("❌ FAILURE: Type NOT found in list.");
        }

        // Cleanup
        await db.collection('empresas').doc(EMPRESA_ID).collection('tiposComponente').doc(newType.id).delete();

    } catch (error) {
        console.error("❌ FAILURE:", error);
    }
}

testTypeCreation().then(() => process.exit(0));
