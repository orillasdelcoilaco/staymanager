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
            console.log(`\n--- Property ID: ${doc.id} ---`);
            const data = doc.data();

            console.log('ALL KEYS:');
            Object.keys(data).forEach(key => console.log(`- ${key}`));

            console.log('\nSPECIFIC FIELDS:');
            console.log('activa:', data.activa);
            console.log('estado:', data.estado);
            console.log('publicarWeb:', data.publicarWeb);
            console.log('publicarGoogle:', data.publicarGoogle);
            console.log('visible:', data.visible);

            console.log('\nNESTED OBJECTS:');
            if (data.websiteData) console.log('websiteData:', JSON.stringify(data.websiteData, null, 2));
            if (data.configuracion) console.log('configuracion:', JSON.stringify(data.configuracion, null, 2));
            if (data.googleHotelData) console.log('googleHotelData:', JSON.stringify(data.googleHotelData, null, 2));

            console.log('\nLOCATION:');
            console.log('ubicacion:', data.ubicacion);
            console.log('direccion:', data.direccion);
            console.log('ciudad:', data.ciudad);
            console.log('comuna:', data.comuna);
            console.log('region:', data.region);
            console.log('pais:', data.pais);
        });

    } catch (error) {
        console.error('Error querying collectionGroup:', error);
    }
}

verifyCollectionGroup();
