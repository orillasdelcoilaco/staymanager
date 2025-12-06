const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
const propiedadId = 'fW2vDX08SX7byB8GII2Q';

async function verify() {
    console.log(`Checking property ${propiedadId} in company ${empresaId}...`);
    const docRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const doc = await docRef.get();

    if (doc.exists) {
        console.log('Property EXISTS!');
        console.log('Data:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('Property DOES NOT EXIST.');
    }
}

verify().catch(console.error);
