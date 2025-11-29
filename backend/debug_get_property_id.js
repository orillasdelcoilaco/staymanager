const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const empresaId = '8IhAYnOOoDTKtuC1UC9r';

async function getPropertyId() {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').limit(1).get();
    if (!snapshot.empty) {
        console.log(snapshot.docs[0].id);
    } else {
        console.log("No properties found");
    }
}

getPropertyId();
