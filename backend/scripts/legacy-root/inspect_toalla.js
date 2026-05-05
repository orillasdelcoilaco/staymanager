const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function inspectToalla() {
    const empresasSnap = await db.collection('empresas').get();
    for (const doc of empresasSnap.docs) {
        console.log(`\n🏢 Empresa: ${doc.data().nombre} (${doc.id})`);
        const assetsSnap = await doc.ref.collection('tiposElemento').get();

        assetsSnap.forEach(d => {
            const data = d.data();
            const name = data.nombre.toLowerCase();
            const icon = data.icono;

            // Log Toallas or Default Icons
            if (name.includes('toalla') || icon === '🔹') {
                console.log(`   🔸 [${data.id}] ${data.nombre} (${data.categoria}) => Icon: ${icon}`);
            }
        });
    }
}

inspectToalla().then(() => process.exit(0));
