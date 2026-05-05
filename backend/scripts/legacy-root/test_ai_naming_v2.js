const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');
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

const { analizarNuevoTipoConIA } = require('../../services/componentesService');

async function testCases() {
    const inputs = [
        "Dormitorio",
        "Dormitorio en Suite",
        "Dormitorio Principal"
    ];

    console.log("🧪 Testing AI Naming Rules...");

    for (const input of inputs) {
        console.log(`\nInput: "${input}"`);
        try {
            const result = await analizarNuevoTipoConIA(input);
            console.log(`Output: "${result.nombreNormalizado}"`);

            // Check Rule 1: "Dormitorio" -> "Dormitorio"
            if (input === "Dormitorio" && result.nombreNormalizado.toLowerCase() !== "dormitorio") {
                console.error("❌ FAIL: Expected 'Dormitorio' but got modified name.");
            }
            // Check Rule 2: "Suite" -> includes "Suite"
            else if (input.includes("Suite") && !result.nombreNormalizado.includes("Suite")) {
                console.error("❌ FAIL: Expected 'Suite' to be preserved.");
            }
            else {
                console.log("✅ PASS");
            }

        } catch (e) {
            console.error("Error:", e);
        }
    }
}

testCases().then(() => process.exit(0));
