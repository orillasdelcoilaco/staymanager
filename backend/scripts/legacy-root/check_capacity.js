
const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json'); // Adjust path if needed, usually passed via env or implicit
// Assuming standard init if not provided
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('d:/pmeza/Desarrollos Render/staymanager/backend/serviceAccountKey.json'))
        });
    } catch (e) {
        console.log("Trying default init...");
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    console.log("Searching for properties...");
    // Scan all companies
    const empresasSnap = await db.collection('empresas').get();

    for (const empDoc of empresasSnap.docs) {
        const empresaId = empDoc.id;
        console.log(`Checking Company: ${empresaId}`);

        // Check TiposElemento
        const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();
        const tipos = tiposSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log("--- Tipos de Elemento ---");
        tipos.filter(t => t.nombre.toLowerCase().includes('cama') || t.nombre.toLowerCase().includes('camarote')).forEach(t => {
            console.log(`Type: ${t.nombre}, Capacity: ${t.capacity}`);
        });

        // Check Properties
        const propSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
        propSnap.docs.forEach(p => {
            const data = p.data();
            // Look for recent ones or matching description
            if (data.nombre && (data.nombre.toLowerCase().includes('cabana') || data.nombre.toLowerCase().includes('cabaña'))) {
                console.log(`\nFound Property: ${data.nombre} (ID: ${p.id})`);
                console.log(`Total Capacity in DB: ${data.capacidad}`);
                console.log(`Calculated Capacity in DB: ${data.calculated_capacity}`);

                if (data.componentes) {
                    data.componentes.forEach(comp => {
                        console.log(`  Component: ${comp.nombre || comp.tipo}`);
                        if (comp.elementos) {
                            comp.elementos.forEach(el => {
                                console.log(`    - Element: ${el.nombre}, Qty: ${el.cantidad}, Unit Cap: ${el.capacity}`);
                            });
                        }
                    });
                }
            }
        });
    }
}

run().catch(console.error);
