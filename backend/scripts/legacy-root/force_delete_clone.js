const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function forceDelete() {
    try {
        console.log("💣 FORCE DELETE Tool Initiated for 'Cabaña 8 (Copia)'...");
        const empresas = await db.collection('empresas').get();

        for (const emp of empresas.docs) {
            const props = await emp.ref.collection('propiedades').get();
            const clone = props.docs.find(d => d.data().nombre && d.data().nombre === 'Cabaña 7 (Copia)');

            if (clone) {
                console.log(`\n🎯 TARGET FOUND in ${emp.id}: ${clone.id}`);

                const batch = db.batch();
                let ops = 0;

                // 1. Delete Dependencies (Rates)
                const tarifas = await emp.ref.collection('tarifas').where('alojamientoId', '==', clone.id).get();
                console.log(`   found ${tarifas.size} tarifas.`);
                tarifas.forEach(t => {
                    batch.delete(t.ref);
                    ops++;
                });

                // 2. Delete Dependencies (Reservations)
                const reservas = await emp.ref.collection('reservas').where('alojamientoId', '==', clone.id).get();
                console.log(`   found ${reservas.size} reservas.`);
                reservas.forEach(r => {
                    batch.delete(r.ref);
                    ops++;
                });

                // 3. Delete Main Doc
                batch.delete(clone.ref);
                ops++;

                await batch.commit();
                console.log(`✅ EXECUTED: Deleted ${ops} documents. Cabaña 8 (Copia) is GONE.`);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

forceDelete();
