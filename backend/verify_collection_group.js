const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function verifyCollectionGroup() {
    console.log('Verifying collectionGroup("propiedades")...');

    try {
        // 1. Basic count
        const snapshot = await db.collectionGroup('propiedades').limit(5).get();
        console.log(`Found ${snapshot.size} properties in total (limit 5).`);

        if (snapshot.empty) {
            console.log('WARNING: No properties found in collectionGroup "propiedades". Check collection name.');
            return;
        }

        snapshot.docs.forEach(doc => {
            console.log(`- ID: ${doc.id}, Path: ${doc.ref.path}`);
            console.log(`  activa: ${doc.data().activa} (Type: ${typeof doc.data().activa})`);
        });

        // 2. Check 'activa' field
        const activeSnapshot = await db.collectionGroup('propiedades').where('activa', '==', true).limit(5).get();
        console.log(`Found ${activeSnapshot.size} ACTIVE properties (limit 5).`);

        if (activeSnapshot.empty) {
            console.log('WARNING: No properties with activa == true found.');
            // Check one doc to see if 'activa' exists
            const sample = snapshot.docs[0].data();
            console.log(`Sample 'activa' value: ${sample.activa} (Type: ${typeof sample.activa})`);
        }

    } catch (error) {
        console.error('Error querying collectionGroup:', error);
    }
}

verifyCollectionGroup();
