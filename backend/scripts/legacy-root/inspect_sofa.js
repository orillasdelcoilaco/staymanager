
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
    // Get first company
    const empresasSnap = await db.collection('empresas').limit(1).get();
    if (empresasSnap.empty) return;
    const empresaId = empresasSnap.docs[0].id;

    // Get 'tiposElemento'
    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();

    console.log(`Searching for Sofa in ${tiposSnap.size} items...`);

    tiposSnap.docs.forEach(doc => {
        const data = doc.data();
        const name = (data.nombre || "").toLowerCase();

        if (name.includes('sofa') || name.includes('sillón')) {
            console.log(`\nID: ${doc.id}`);
            console.log(`Name: ${data.nombre}`);
            console.log(`Countable: ${data.countable}`);
            console.log(`Capacity: ${data.capacity}`);
        }
    });
}

run().catch(console.error);
