const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function listAllClones() {
    try {
        console.log("🕵️‍♂️ Listing ALL properties with '(Copia)' in name...");
        const empresas = await db.collection('empresas').get();
        let totalClones = 0;

        for (const emp of empresas.docs) {
            const props = await emp.ref.collection('propiedades').get();
            const clones = props.docs.filter(d => d.data().nombre && d.data().nombre.includes('(Copia)'));

            if (clones.length > 0) {
                console.log(`\n🏢 Empresa: ${emp.id}`);
                for (const c of clones) {
                    console.log(`   🔸 ID: ${c.id}`);
                    console.log(`      Nombre: "${c.data().nombre}"`);
                    console.log(`      Fecha Creación: ${c.data().fechaCreacion ? c.data().fechaCreacion.toDate() : 'N/A'}`);

                    // Check dependecies
                    const tarifas = await emp.ref.collection('tarifas').where('alojamientoId', '==', c.id).get();
                    const reservas = await emp.ref.collection('reservas').where('alojamientoId', '==', c.id).get();
                    console.log(`      Deps: ${tarifas.size} Tarifas, ${reservas.size} Reservas`);
                }
                totalClones += clones.length;
            }
        }
        console.log(`\n📊 Total Clones Found: ${totalClones}`);
    } catch (error) {
        console.error("Error:", error);
    }
}

listAllClones();
