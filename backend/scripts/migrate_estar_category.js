const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin (similar to other scripts)
const serviceAccountPath = path.join(__dirname, '..', '..', 'backend', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Error: serviceAccountKey.json not found at:', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateCategories() {
    console.log('--- Starting Migration: Estar -> Sala de Estar ---');

    // We want to find any category that matches "estar" (case-insensitive ideally, but Firestore is case sensitive).
    // We'll target "Estar" and "estar". "Sala de Estar" is already correct.

    const snapshot = await db.collection('tiposElemento').get();
    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const currentCat = (data.categoria || '').trim();

        if (currentCat.toLowerCase() === 'estar') {
            const ref = db.collection('tiposElemento').doc(doc.id);
            console.log(`[MIGRATE] Updating "${data.nombre}" (${doc.id}): "${currentCat}" -> "Sala de Estar"`);
            batch.update(ref, { categoria: 'Sala de Estar' });
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully updated ${updatedCount} documents.`);
    } else {
        console.log('✨ No documents needed update.');
    }
}

migrateCategories()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
