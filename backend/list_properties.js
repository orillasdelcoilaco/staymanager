const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listProperties() {
    try {
        const companiesSnapshot = await db.collection('empresas').get();
        console.log(`Scanning ${companiesSnapshot.size} companies for properties...`);

        for (const companyDoc of companiesSnapshot.docs) {
            const propsSnapshot = await db.collection('propiedades')
                .where('empresaId', '==', companyDoc.id)
                .limit(1)
                .get();

            if (!propsSnapshot.empty) {
                const data = companyDoc.data();
                const subdomain = data.websiteSettings ? data.websiteSettings.subdomain : 'N/A';
                console.log(`\nFOUND COMPANY WITH PROPERTIES:`);
                console.log(`- ID: ${companyDoc.id}`);
                console.log(`- Name: ${data.nombre}`);
                console.log(`- Subdomain: ${subdomain}`);

                const prop = propsSnapshot.docs[0];
                console.log(`- Sample Property ID: ${prop.id}`);
                console.log(`- Sample Property Name: ${prop.data().titulo}`);
                console.log(`- Sample Property Capacity: ${prop.data().capacidad}`);

                // We just need one good example
                return;
            }
        }

        console.log('No companies with properties found.');

    } catch (error) {
        console.error('Error listing properties:', error);
    }
}

listProperties();
