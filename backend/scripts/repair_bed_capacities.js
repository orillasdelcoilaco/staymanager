const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function repairCapacities() {
    console.log(`🔧 Repairing Bed Capacities for: ${EMPRESA_ID}`);

    const collectionRef = db.collection('empresas').doc(EMPRESA_ID).collection('tiposElemento');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        console.log("❌ No types found.");
        return;
    }

    const batch = db.batch();
    let updates = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const name = (data.nombre || '').toUpperCase();
        let correctCapacity = null;

        // LOGIC FROM STANDARD ASSETS
        if (name.includes('CAMAROTE') || name.includes('LITERA') || name.includes('CAMA NIDO') || name.includes('TRUNDLE')) {
            correctCapacity = 2;
        } else if (name.includes('KING') || name.includes('QUEEN') || name.includes('2 PLAZAS') || name.includes('DOBLE') || name.includes('MATRIMONIAL')) {
            correctCapacity = 2;
        } else if (name.includes('1 PLAZA') || name.includes('SINGLE') || name.includes('INDIVIDUAL') || name.includes('CATRE') || name.includes('CUNA')) {
            correctCapacity = 1;
        } else if (name === 'CAMA' || name === 'BED') {
            // Generic 'Cama' -> 1 safely
            correctCapacity = 1;
        }

        // Only update if it helps (current is 0 or undefined, and we have a better guess)
        if (correctCapacity !== null && (!data.capacity || data.capacity === 0)) {
            console.log(`✅ Updating '${data.nombre}': Capacity ${data.capacity} -> ${correctCapacity}`);
            batch.update(doc.ref, { capacity: correctCapacity });
            updates++;
        }
    });

    if (updates > 0) {
        await batch.commit();
        console.log(`✨ Fixed ${updates} bed types.`);
    } else {
        console.log("✨ No updates needed.");
    }
}

repairCapacities().then(() => process.exit(0));
