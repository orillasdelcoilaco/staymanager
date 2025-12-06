const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkListings() {
    console.log("--- Checking Property Listings for 'isListed' flag ---");
    const empresasSnap = await db.collection('empresas').get();

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        console.log(`\nEmpresa: ${empresaId} (${empresaDoc.data().nombre})`);

        const propsSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
        if (propsSnap.empty) {
            console.log("  No properties found.");
            continue;
        }

        propsSnap.forEach(doc => {
            const data = doc.data();
            const isListed = data.googleHotelData?.isListed;
            const hasImage = !!(data.websiteData?.cardImage?.storagePath);

            console.log(`  Prop: [${doc.id}] ${data.nombre}`);
            console.log(`    - googleHotelData.isListed: ${isListed} (Type: ${typeof isListed})`);
            console.log(`    - Has Card Image: ${hasImage}`);

            // Logic check matching publicWebsiteService
            const shouldShow = (isListed === true);
            console.log(`    -> Should Show in Service? ${shouldShow}`);
        });
    }
}

checkListings().then(() => process.exit()).catch(e => console.error(e));
