const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixProperties() {
    try {
        const empresaId = 'cv1Lb4HLBLvWvSyqYfRW'; // ID from debug script
        console.log(`Fixing properties for empresa: ${empresaId}`);

        const snapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').get();

        if (snapshot.empty) {
            console.log('No properties found.');
            return;
        }

        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            let update = {};
            let needsUpdate = false;

            // Ensure isListed is true
            if (!data.googleHotelData || data.googleHotelData.isListed !== true) {
                update['googleHotelData.isListed'] = true;
                needsUpdate = true;
            }

            // Ensure cardImage exists
            if (!data.websiteData || !data.websiteData.cardImage || !data.websiteData.cardImage.storagePath) {
                update['websiteData.cardImage'] = {
                    storagePath: 'https://via.placeholder.com/400x300',
                    altText: 'Imagen de prueba',
                    title: 'Propiedad de prueba'
                };
                needsUpdate = true;
            }

            // Ensure capacity is set (for grouping logic)
            if (!data.capacidad) {
                update['capacidad'] = 4; // Default capacity
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, update);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Updated ${count} properties to be listed and have images.`);
        } else {
            console.log('All properties are already correctly configured.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

fixProperties();
