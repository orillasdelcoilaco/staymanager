const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function createTestProperty() {
    try {
        const companyId = 'cv1Lb4HLBLvWvSyqYfRW'; // Prueba 1

        const propertyId = 'fW2vDX08SX7byB8GII2Q';
        const propertyRef = db.collection('empresas').doc(companyId).collection('propiedades').doc(propertyId);

        await propertyRef.set({
            nombre: 'Propiedad de Prueba',
            capacidad: 6,
            googleHotelData: { isListed: true },
            websiteData: {
                cardImage: { storagePath: 'https://via.placeholder.com/300' }
            }
        }, { merge: true });

        console.log(`Updated property with ID: ${propertyId}`);

    } catch (error) {
        console.error('Error creating property:', error);
    }
}

createTestProperty();
