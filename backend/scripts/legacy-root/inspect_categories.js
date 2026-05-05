
const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('d:/pmeza/Desarrollos Render/staymanager/backend/serviceAccountKey.json'))
        });
    } catch (e) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    const empresasSnap = await db.collection('empresas').limit(1).get();
    if (empresasSnap.empty) return;
    const empresaId = empresasSnap.docs[0].id;

    console.log(`Inspecting Asset Categories for Empresa: ${empresaId}`);

    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();

    // Group by category
    const categories = {};

    tiposSnap.docs.forEach(doc => {
        const data = doc.data();
        const cat = data.categoria || "UNCATEGORIZED";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(data.nombre);
    });

    console.log(`Found ${Object.keys(categories).length} categories.`);
    for (const [cat, items] of Object.entries(categories)) {
        console.log(`\n[${cat}] (${items.length} items):`);
        console.log(items.slice(0, 10).join(', ') + (items.length > 10 ? '...' : ''));
    }
}

run().catch(console.error);
