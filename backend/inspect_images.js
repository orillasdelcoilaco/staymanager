const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectImages() {
    try {
        const snapshot = await db.collection('empresas').get();
        if (snapshot.empty) {
            console.log('No companies found');
            return;
        }

        const empresaId = snapshot.docs[0].id;
        console.log(`Checking properties for company: ${empresaId}`);

        const propsSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').limit(300).get();

        if (propsSnapshot.empty) {
            console.log('No properties found');
            return;
        }

        let propertiesWithEmptyImages = 0;

        for (const doc of propsSnapshot.docs) {
            const prop = doc.data();
            let hasImages = false;
            let source = '';

            if (prop.websiteData && prop.websiteData.images && Object.keys(prop.websiteData.images).length > 0) {
                hasImages = true;
                source = 'websiteData.images';
            } else if (Array.isArray(prop.imagenes) && prop.imagenes.length > 0) {
                hasImages = true;
                source = 'imagenes array';
            }

            if (hasImages) {
                console.log(`Found property with images (${source}): ${doc.id}`);
                if (source === 'websiteData.images') {
                    console.log('Structure:', JSON.stringify(prop.websiteData.images, null, 2));
                } else {
                    console.log('Structure:', JSON.stringify(prop.imagenes, null, 2));
                }
                return;
            }
        }
        console.log('No properties with images found in the first 300');

    } catch (error) {
        console.error('Error:', error);
    }
}

inspectImages();
