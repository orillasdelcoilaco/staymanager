const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function checkCapacities() {
    console.log(`🚀 Checking Element Types for Enterprise: ${EMPRESA_ID}`);

    const snapshot = await db.collection('empresas').doc(EMPRESA_ID).collection('tiposElemento').get();

    if (snapshot.empty) {
        console.log("❌ No element types found.");
        return;
    }

    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const targets = ['AMAROTE', 'NIDO', 'CAMA', 'LITERA']; // Fuzzy search terms

    console.log("--- Suspect Items ---");
    items.forEach(t => {
        const nameUpper = (t.nombre || '').toUpperCase();
        if (targets.some(target => nameUpper.includes(target))) {
            console.log(`[${t.id}] ${t.nombre}`);
            console.log(`   Capacity: ${t.capacity}`);
            console.log(`   Icon: ${t.icono}`);
            console.log('-------------------');
        }
    });
}

checkCapacities().then(() => process.exit(0));
