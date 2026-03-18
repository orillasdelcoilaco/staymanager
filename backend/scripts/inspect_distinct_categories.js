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

async function inspectDistinctCategories() {
    console.log('--- Inspecting Distinct Categories ---');

    // Get the first company
    const companiesSnap = await db.collection('empresas').limit(1).get();
    if (companiesSnap.empty) {
        console.log('No companies found.');
        return;
    }
    const empresaId = companiesSnap.docs[0].id;
    console.log(`Targeting Empresa: ${empresaId}`);

    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();
    console.log(`Total documents found: ${snapshot.size}`);

    const categories = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const cat = data.categoria; // Un-trimmed raw value
        if (cat) {
            if (!categories[cat]) categories[cat] = 0;
            categories[cat]++;
        } else {
            if (!categories['UNDEFINED']) categories['UNDEFINED'] = 0;
            categories['UNDEFINED']++;
        }
    });

    console.log('Unique Categories Found:');
    Object.keys(categories).sort().forEach(cat => {
        // Log with surrounding quotes to detect whitespace
        console.log(`"${cat}": ${categories[cat]} items`);
    });
}

inspectDistinctCategories()
    .then(() => process.exit(0))
    .catch(err => console.error(err));
