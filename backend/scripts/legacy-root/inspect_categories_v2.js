const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function inspect() {
    const empresasSnap = await db.collection('empresas').get();
    for (const doc of empresasSnap.docs) {
        console.log(`--- COMPANY: ${doc.data().nombre} (${doc.id}) ---`);
        const assetsSnap = await doc.ref.collection('tiposElemento').get();

        const counts = {};
        assetsSnap.forEach(d => {
            const cat = d.data().categoria || 'SIN_CATEGORIA';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        console.log(JSON.stringify(counts, null, 2));
    }
}

inspect().then(() => process.exit(0));
