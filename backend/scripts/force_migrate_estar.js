const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', '..', 'backend', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function forceMigrate() {
    console.log('--- Force Migration: Estar -> Sala de Estar ---');

    // Get the first company
    const companiesSnap = await db.collection('empresas').limit(1).get();
    if (companiesSnap.empty) {
        console.log('No companies found.');
        return;
    }
    const empresaId = companiesSnap.docs[0].id;
    console.log(`Targeting Empresa: ${empresaId}`);

    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();
    const batch = db.batch();
    let updatedCount = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const currentCat = (data.categoria || '').trim();
        const lowerCat = currentCat.toLowerCase();

        // Target "estar" (case insensitive) AND "sala de estar" (case insensitive)
        // We want to unify everything to "Sala de Estar"
        // If it's already exactly "Sala de Estar", skip it.

        if ((lowerCat === 'estar' || lowerCat === 'sala de estar') && currentCat !== 'Sala de Estar') {
            const ref = db.collection('empresas').doc(empresaId).collection('tiposElemento').doc(doc.id);
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

forceMigrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
