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
        const snapshot = await db.collectionGroup('propiedades').limit(1).get();

        if (snapshot.empty) {
            console.log('No matching documents.');
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log('--- Document Structure (Top Level) ---');
        Object.keys(data).forEach(key => console.log(key));

        if (data.websiteData) {
            console.log('--- websiteData ---');
            Object.keys(data.websiteData).forEach(key => console.log(`websiteData.${key}`));
        }

        if (data.googleHotelData) {
            console.log('--- googleHotelData ---');
            Object.keys(data.googleHotelData).forEach(key => console.log(`googleHotelData.${key}`));
        }

        console.log('--- Values Check ---');
        console.log('activa:', data.activa);
        console.log('publicarWeb:', data.publicarWeb);
        console.log('googleHotelData.isListed:', data.googleHotelData?.isListed);
        console.log('websiteData.publicar:', data.websiteData?.publicar);

    } catch (error) {
        console.error('Error querying collectionGroup:', error);
    }
}

verifyCollectionGroup();
