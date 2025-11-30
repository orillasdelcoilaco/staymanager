const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateIsListed() {
    console.log('Starting migration: googleHotelData.isListed -> isListed (root)...');

    try {
        const snapshot = await db.collectionGroup('propiedades').get();
        console.log(`Found ${snapshot.size} properties to check.`);

        let updatedCount = 0;
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            let needsUpdate = false;
            let newValue = false;

            // Check source value
            if (data.googleHotelData && typeof data.googleHotelData.isListed !== 'undefined') {
                newValue = data.googleHotelData.isListed;
            }

            // Check if update is needed (if root field is missing or different)
            if (data.isListed !== newValue) {
                const docRef = doc.ref;
                batch.update(docRef, { isListed: newValue });
                needsUpdate = true;
                updatedCount++;
                batchCount++;
                console.log(`[UPDATE] ${doc.id}: isListed set to ${newValue}`);
            }

            // Commit batch every 500 writes
            if (batchCount >= 400) {
                await batch.commit();
                console.log('--- Batch committed ---');
                batch = db.batch();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log('--- Final batch committed ---');
        }

        console.log(`Migration complete. Updated ${updatedCount} documents.`);

    } catch (error) {
        console.error('Error during migration:', error);
    }
}

migrateIsListed();
