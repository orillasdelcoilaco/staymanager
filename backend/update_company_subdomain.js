const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const empresaId = '8IhAYnOOoDTKtuC1UC9r'; // Test Company ID

async function updateSubdomain() {
    await db.collection('empresas').doc(empresaId).update({
        'websiteSettings.subdomain': 'test-ai'
    });
    console.log(`Updated subdomain for ${empresaId} to 'test-ai'`);
}

updateSubdomain();
