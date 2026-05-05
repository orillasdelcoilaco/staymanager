const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function auditAssets() {
    try {
        console.log("🕵️‍♂️ Auditing Assets per Company...");
        const empresas = await db.collection('empresas').get();

        for (const doc of empresas.docs) {
            const data = doc.data();
            const assetsSnap = await doc.ref.collection('tiposElemento').get();
            console.log(`🏢 [${doc.id}] ${data.nombreFantasia || data.subdominio || 'Unnamed'}: ${assetsSnap.size} activos`);

            if (assetsSnap.size > 0) {
                console.log(`   Ejemplos: ${assetsSnap.docs.slice(0, 3).map(d => d.data().nombre).join(', ')}`);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

auditAssets();
