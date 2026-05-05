const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const TARGET_RATE_ID = 'aBrd8yNa6DdObzPWZQVP';

async function forceDeleteByRate() {
    try {
        console.log(`💣 FORCE DELETE Tool: Searching for dependencies of Rate ${TARGET_RATE_ID}...`);

        // 1. Find the Rate to get the Property ID
        // Since we don't know the company, we must search all companies (or collectionGroup if indexed, but iterative is safer for scripts)
        const empresas = await db.collection('empresas').get();
        let foundRate = null;
        let foundEmpresaId = null;
        let targetPropId = null;

        for (const emp of empresas.docs) {
            const rateDoc = await emp.ref.collection('tarifas').doc(TARGET_RATE_ID).get();
            if (rateDoc.exists) {
                foundRate = rateDoc;
                foundEmpresaId = emp.id;
                targetPropId = rateDoc.data().alojamientoId;
                console.log(`🎯 FOUND Rate in Empresa: ${emp.id}`);
                console.log(`   Linked to Property ID: ${targetPropId}`);
                break;
            }
        }

        if (!foundRate || !targetPropId) {
            console.error("❌ Could not find the specified rate or it has no property link.");
            return;
        }

        // 2. Delete Everything related to that Property ID
        const batch = db.batch();
        const empRef = db.collection('empresas').doc(foundEmpresaId);
        let ops = 0;

        // Delete ALL Rates for this property
        const allRates = await empRef.collection('tarifas').where('alojamientoId', '==', targetPropId).get();
        allRates.forEach(d => { batch.delete(d.ref); ops++; });
        console.log(`   Queued ${allRates.size} rates for deletion.`);

        // Delete ALL Reservations for this property
        const allRes = await empRef.collection('reservas').where('alojamientoId', '==', targetPropId).get();
        allRes.forEach(d => { batch.delete(d.ref); ops++; });
        console.log(`   Queued ${allRes.size} reservations for deletion.`);

        // Delete The Property Itself
        const propRef = empRef.collection('propiedades').doc(targetPropId);
        // Also delete subcollections (Componentes/Amenidades) manually if needed, 
        // but typically just deleting the parent ref in Firestore doesn't delete subs. 
        // For a true clean, we should delete subs.

        const subComps = await propRef.collection('componentes').get();
        subComps.forEach(d => { batch.delete(d.ref); ops++; });

        const subAmens = await propRef.collection('amenidades').get();
        subAmens.forEach(d => { batch.delete(d.ref); ops++; });

        batch.delete(propRef);
        ops++;

        await batch.commit(); // Max 500 ops per batch, should be fine for one property
        console.log(`✅ SUCCESS: Deleted property ${targetPropId} and ${ops} related documents.`);

    } catch (error) {
        console.error("Error:", error);
    }
}

forceDeleteByRate();
