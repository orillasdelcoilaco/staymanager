const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listCategories() {
    try {
        console.log("🕵️‍♂️ Listing Asset Categories...");
        const empresas = await db.collection('empresas').get();

        for (const doc of empresas.docs) {
            console.log(`\n🏢 Empresa: ${doc.id}`);
            const assetsSnap = await doc.ref.collection('tiposElemento').get();
            const categories = new Set();
            const examples = [];

            assetsSnap.forEach(d => {
                const data = d.data();
                if (data.categoria) categories.add(data.categoria);
                if (data.categoria && (data.categoria.includes('BA') || data.categoria.includes('ba'))) {
                    examples.push(`${data.nombre} -> ${data.categoria}`);
                }
            });

            console.log(`   📂 Categorías encontradas:`, Array.from(categories));
            console.log(`   🛀 Ejemplos 'Baño':`, examples);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listCategories();
