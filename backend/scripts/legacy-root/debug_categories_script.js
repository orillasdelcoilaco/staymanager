
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Try to initialize app
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('../../serviceAccountKey.json'))
        });
    } catch (e) {
        console.error("Auth error:", e.message);
        try { admin.initializeApp(); } catch (e2) { }
    }
}

const db = admin.firestore();

async function run() {
    const empresasSnap = await db.collection('empresas').limit(1).get();
    if (empresasSnap.empty) {
        console.log("No companies found.");
        return;
    }
    const empresaId = empresasSnap.docs[0].id;
    console.log(`Inspecting categories for: ${empresaId}`);

    const snapshot = await db.collection('empresas')
        .doc(empresaId)
        .collection('tiposElemento')
        .get();

    const categories = new Set();
    const rawData = [];

    snapshot.forEach(doc => {
        const d = doc.data();
        if (d.categoria) {
            categories.add(d.categoria);
            rawData.push({ id: doc.id, name: d.nombre, category: d.categoria });
        }
    });

    const sortedCats = Array.from(categories).sort();

    let output = `Total Unique Categories: ${sortedCats.length}\n`;
    output += `Categories List:\n${sortedCats.join('\n')}\n\n`;

    output += "--- DETAILS ---\n";
    rawData.forEach(r => {
        if (r.category.toLowerCase().includes(' comedor') || r.category.toLowerCase().startsWith('comedor')) {
            output += `[${r.category}] - ${r.name} (${r.id})\n`;
        }
    });

    fs.writeFileSync(path.join(__dirname, 'categories_output.txt'), output);
    console.log("Output written to categories_output.txt");
}

run().catch(console.error);
