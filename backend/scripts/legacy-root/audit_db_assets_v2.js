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
        console.log("🕵️‍♂️ Auditing Assets per Company (Subdomain Mapping)...");
        const empresas = await db.collection('empresas').get();

        for (const doc of empresas.docs) {
            const data = doc.data();
            const assetsSnap = await doc.ref.collection('tiposElemento').get();
            const subdomain = data.subdominio || 'NO_SUBDOMAIN';
            const dominios = data.dominios || [];

            console.log(`🏢 ID: [${doc.id}] | Sub: ${subdomain} | Dominios: ${dominios.join(', ')}`);
            if (dominios.includes('localhost') || subdomain === 'localhost') {
                console.log("   🎯 FOUND LOCALHOST TARGET!");
            }
            console.log(`   --> Activos: ${assetsSnap.size}`);
            if (assetsSnap.size > 0) {
                console.log(`       Preview: ${assetsSnap.docs.slice(0, 3).map(d => d.data().nombre).join(', ')}`);
            }
            console.log("---------------------------------------------------");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

auditAssets();
