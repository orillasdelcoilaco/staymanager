const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW'; // ID confirmed from logs

async function cleanupDuplicates() {
    console.log(`🧹 Starting Cleanup for Enterprise: ${EMPRESA_ID}`);

    const snapshot = await db.collection('empresas').doc(EMPRESA_ID).collection('tiposComponente').orderBy('fechaCreacion', 'desc').get();

    if (snapshot.empty) {
        console.log("❌ No types found.");
        return;
    }

    const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), ref: doc.ref }));
    console.log(`🔍 Found ${types.length} total types.`);

    const seenNames = new Set();
    const toDelete = [];

    // Iterate through sorted List (Newest First due to 'desc' order)
    for (const t of types) {
        const nameKey = (t.nombreNormalizado || t.nombreUsuario || 'Unknown').trim().toLowerCase();

        if (seenNames.has(nameKey)) {
            // Duplicate found! Since we are iterating newest first, this is an OLDER duplicate.
            console.log(`🗑️ Marking for deletion: "${t.nombreNormalizado}" (ID: ${t.id}) - Duplicate of newer entry.`);
            toDelete.push(t.ref);
        } else {
            // First time seeing this name (it's the newest one). Keep it.
            seenNames.add(nameKey);
            console.log(`✅ Keeping: "${t.nombreNormalizado}" (ID: ${t.id})`);
        }
    }

    if (toDelete.length === 0) {
        console.log("✨ No duplicates found.");
    } else {
        console.log(`🔥 Deleting ${toDelete.length} duplicates...`);
        const batch = db.batch();
        toDelete.forEach(ref => batch.delete(ref));
        await batch.commit();
        console.log("✨ Cleanup Complete!");
    }
}

cleanupDuplicates().then(() => process.exit(0));
