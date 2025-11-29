const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const empresaId = '8IhAYnOOoDTKtuC1UC9r'; // Test Company
const propiedadId = '90qbyAodIhKPeVXdRt8T'; // Test Property

async function inspectProperty() {
    const doc = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).get();
    if (doc.exists) {
        console.log(JSON.stringify(doc.data(), null, 2));
    } else {
        console.log("Property not found");
    }
}

inspectProperty();
