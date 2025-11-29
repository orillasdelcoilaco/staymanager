const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function getPropertyId() {
    try {
        const snapshot = await db.collection('empresas').get();
        if (snapshot.empty) {
            console.log('No companies found');
            return;
        }

        const empresaId = snapshot.docs[0].id;
        console.log(`Company ID: ${empresaId}`);

        const propsSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').limit(1).get();

        if (propsSnapshot.empty) {
            console.log('No properties found');
            return;
        }

        const propId = propsSnapshot.docs[0].id;
        console.log(`Property ID: ${propId}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

getPropertyId();
