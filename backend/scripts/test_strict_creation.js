const admin = require('firebase-admin');
const { crearTipo } = require('../services/tiposElementoService');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function testStrictCreation() {
    console.log(`🧪 Testing Strict Creation rules for: ${EMPRESA_ID}`);

    const badData = {
        nombre: "  Silla de Playa  ",
        categoria: "   eXTeRiOr   ", // Should become 'Exterior'
        icono: "🏖️",
        permiteCantidad: true
    };

    console.log("Input Data:", badData);

    try {
        const result = await crearTipo(db, EMPRESA_ID, badData);
        console.log("✅ Created Type:", result);

        if (result.categoria === 'Exterior' && result.nombre === 'Silla de Playa') {
            console.log("🎉 SUCCESS: Category and Name normalized correctly!");
        } else {
            console.error("❌ FAILURE: Normalization failed.", result);
        }

        // Cleanup
        await db.collection('empresas').doc(EMPRESA_ID).collection('tiposElemento').doc(result.id).delete();
        console.log("🧹 Test item deleted.");

    } catch (error) {
        console.error("Error:", error);
    }
}

testStrictCreation().then(() => process.exit(0));
