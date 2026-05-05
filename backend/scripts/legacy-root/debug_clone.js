const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspectClone() {
    try {
        console.log("🕵️‍♂️ Buscando 'Cabaña 8 (copia)'...");
        const empresas = await db.collection('empresas').get();

        for (const emp of empresas.docs) {
            const props = await emp.ref.collection('propiedades').get();
            const source = props.docs.find(d => d.data().nombre === 'Cabaña 8'); // Exact match
            const clone = props.docs.find(d => d.data().nombre && d.data().nombre.includes('(Copia)'));

            if (source) {
                console.log(`\n📦 SOURCE: ${source.id} (${source.data().nombre})`);
                const sub = await source.ref.collection('componentes').get();
                console.log(`   SubComps: ${sub.size}`);
                console.log(`   ArrayComps: ${source.data().componentes ? source.data().componentes.length : 0}`);
            }

            if (clone) {
                console.log(`\n🎯 ENCONTRADO en Empresa: ${emp.id}`);
                console.log(`   ID Clon: ${clone.id}`);
                console.log(`   Nombre: ${clone.data().nombre}`);
                console.log(`   Componentes (Array):`, clone.data().componentes ? clone.data().componentes.length : 'NULL');

                const subComponents = await clone.ref.collection('componentes').get();
                console.log(`   Componentes (Subcolección): ${subComponents.size}`);
                if (subComponents.size > 0) {
                    console.log(`     Ejemplo SC: ${subComponents.docs[0].data().nombre}`);
                }

                // Check for Reservations
                const reservas = await emp.ref.collection('reservas').where('alojamientoId', '==', clone.id).get();
                console.log(`   ❌ Reservas vinculadas: ${reservas.size}`);
                if (reservas.size > 0) {
                    reservas.forEach(r => console.log(`      - ReservaID: ${r.id}, Start: ${r.data().start}`));
                }

                // Check for Rates
                const tarifas = await emp.ref.collection('tarifas').where('alojamientoId', '==', clone.id).get();
                console.log(`   ❌ Tarifas vinculadas: ${tarifas.size}`);
                if (tarifas.size > 0) {
                    tarifas.forEach(t => console.log(`      - TarifaID: ${t.id}, AlojamientoRef: ${t.data().alojamientoId}`));
                }

                // Check for Rates with loose constraints (maybe name string match?)
                // just in case
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

inspectClone();
