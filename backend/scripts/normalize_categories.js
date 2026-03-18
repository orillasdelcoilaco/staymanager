const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function normalize() {
    console.log('🚀 Starting Category Normalization...');
    const empresasSnap = await db.collection('empresas').get();

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        console.log(`\n🏢 Processing ${empresaDoc.data().nombre} (${empresaId})`);

        const assetsSnap = await empresaDoc.ref.collection('tiposElemento').get();
        const batch = db.batch();
        let ops = 0;

        assetsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.categoria) return;

            const currentCat = data.categoria;
            const upperCat = currentCat.toUpperCase().trim();

            if (currentCat !== upperCat) {
                console.log(`   ✏️ Fixing: "${currentCat}" -> "${upperCat}" (${data.nombre})`);
                batch.update(doc.ref, { categoria: upperCat });
                ops++;
            }
        });

        if (ops > 0) {
            await batch.commit();
            console.log(`   ✅ Updated ${ops} items.`);
        } else {
            console.log(`   ✨ All clean.`);
        }
    }
}

normalize().then(() => {
    console.log('\nDone.');
    process.exit(0);
});
