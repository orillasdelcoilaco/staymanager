
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
    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();

    console.log(`Listing ${tiposSnap.size} types:`);
    tiposSnap.docs.forEach(doc => {
        console.log(`- ${doc.data().nombre} (Cap: ${doc.data().capacity}, Countable: ${doc.data().countable}, Capacidad: ${doc.data().capacidad})`);
    });
}

run().catch(console.error);
