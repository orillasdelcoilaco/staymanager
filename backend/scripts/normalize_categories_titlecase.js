const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Override specifics if needed (e.g. "TV" vs "Tv")
const OVERRIDES = {
    'Tv': 'TV',
    'Wc': 'WC',
    'Wifi': 'WiFi',
    'Bbq': 'BBQ'
};

async function normalize() {
    console.log('🚀 Starting Category Normalization (Title Case)...');
    const empresasSnap = await db.collection('empresas').get();

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        console.log(`\n🏢 Processing ${empresaDoc.data().nombre} (${empresaId})`);

        const assetsSnap = await empresaDoc.ref.collection('tiposElemento').get();
        const batch = db.batch();
        let ops = 0;

        for (const doc of assetsSnap.docs) {
            const data = doc.data();
            if (!data.categoria) continue;

            const currentCat = data.categoria;
            let targetCat = toTitleCase(currentCat.trim());

            // Apply Manual Overrides for specific words?
            // Actually, keep it simple. "COMEDOR" -> "Comedor"

            // Special fix: If target is "Comedor", ensure it matches standardAssets
            if (targetCat === 'Comedor') targetCat = 'Comedor';

            if (currentCat !== targetCat) {
                // Check if we are merging into an existing category?
                // Visual normalization only here.
                console.log(`   ✏️ Fixing: "${currentCat}" -> "${targetCat}" (${data.nombre})`);
                batch.update(doc.ref, { categoria: targetCat });
                ops++;
            }
        }

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
