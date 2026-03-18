const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function inspectCategories() {
    console.log(`🚀 Inspecting Categories for: ${EMPRESA_ID}`);

    const snapshot = await db.collection('empresas').doc(EMPRESA_ID).collection('tiposElemento').get();

    if (snapshot.empty) {
        console.log("❌ No items found.");
        return;
    }

    const categories = new Set();
    const details = {};

    snapshot.docs.forEach(doc => {
        const cat = doc.data().categoria || 'OTROS';
        categories.add(cat);

        if (!details[cat]) {
            details[cat] = { count: 0, examples: [] };
        }
        details[cat].count++;
        if (details[cat].examples.length < 3) {
            details[cat].examples.push(doc.data().nombre);
        }
    });

    console.log(`\nFound ${categories.size} unique category strings:`);

    Array.from(categories).sort().forEach(cat => {
        console.log(`\nCategory: "${cat}"`);
        console.log(`   Length: ${cat.length}`);

        // Print character codes
        const codes = [];
        for (let i = 0; i < cat.length; i++) {
            codes.push(cat.charCodeAt(i));
        }
        console.log(`   Char Codes: [${codes.join(', ')}]`);
        console.log(`   Items count: ${details[cat].count}`);
        console.log(`   Examples: ${details[cat].examples.join(', ')}`);
    });
}

inspectCategories().then(() => process.exit(0));
