const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedImages() {
    try {
        const empresaId = '8IhAYnOOoDTKtuC1UC9r';
        const propertyId = '90qbyAodIhKPeVXdRt8T';

        console.log(`Seeding images for property: ${propertyId}`);

        const propertyRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propertyId);

        const dummyImages = {
            "img1": {
                "storagePath": "https://firebasestorage.googleapis.com/v0/b/bucket/o/img1.jpg",
                "description": "Vista panorámica al lago desde la terraza",
                "tags": ["vista", "lago", "terraza"],
                "category": "exterior"
            },
            "img2": {
                "storagePath": "https://firebasestorage.googleapis.com/v0/b/bucket/o/img2.jpg",
                "description": "Cocina equipada con isla central",
                "tags": ["cocina", "interior", "equipamiento"],
                "category": "interior"
            }
        };

        await propertyRef.update({
            "websiteData.images": dummyImages
        });

        console.log('Successfully seeded images.');

    } catch (error) {
        console.error('Error:', error);
    }
}

seedImages();
