const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listCompanies() {
    const snapshot = await db.collection('empresas').get();
    const companies = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        companies.push({
            id: doc.id,
            nombre: data.nombre,
            domain: data.websiteSettings?.domain,
            subdomain: data.websiteSettings?.subdomain
        });
    });
    console.log(JSON.stringify(companies, null, 2));
}

listCompanies();
