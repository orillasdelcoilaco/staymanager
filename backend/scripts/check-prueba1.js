const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkPrueba1() {
    console.log('Buscando empresa con subdomain "prueba1"...');
    const qSub = db.collection('empresas').where('websiteSettings.subdomain', '==', 'prueba1');
    const snapSub = await qSub.get();

    if (!snapSub.empty) {
        console.log('✅ Encontrada por websiteSettings.subdomain = "prueba1"');
        snapSub.docs.forEach(d => console.log(d.id, d.data().websiteSettings));
    } else {
        console.log('❌ NO encontrada por websiteSettings.subdomain = "prueba1"');
    }

    console.log('\nBuscando empresa con nombre "prueba1"...');
    const qName = db.collection('empresas').where('nombre', '==', 'prueba1');
    const snapName = await qName.get();

    if (!snapName.empty) {
        console.log('✅ Encontrada por nombre = "prueba1"');
        snapName.docs.forEach(d => {
            console.log(`ID: ${d.id}`);
            console.log('websiteSettings:', d.data().websiteSettings);
        });
    } else {
        console.log('❌ NO encontrada por nombre = "prueba1"');
    }
}

checkPrueba1().catch(console.error);
