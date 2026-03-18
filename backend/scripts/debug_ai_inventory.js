const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const path = require('path');

// Mock process.env for the service
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
// Import logic
const { analizarNuevoTipoConIA } = require('../services/componentesService');

async function debug() {
    const term = "terraza techada";
    console.log(`🤖 Testing AI Analysis for: "${term}"`);

    try {
        const result = await analizarNuevoTipoConIA(term);
        console.log("\n📄 Result:");
        console.log(JSON.stringify(result, null, 2));

        if (result.inventarioSugerido && result.inventarioSugerido.length > 0) {
            console.log("✅ Inventory suggested!");
        } else {
            console.log("⚠️ No inventory suggested (Empty array).");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

debug().then(() => process.exit(0));
