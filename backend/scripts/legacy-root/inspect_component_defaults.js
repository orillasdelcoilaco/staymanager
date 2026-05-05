
const admin = require('firebase-admin');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(require('d:/pmeza/Desarrollos Render/staymanager/backend/serviceAccountKey.json'))
        });
    } catch (e) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    const empresasSnap = await db.collection('empresas').limit(1).get();
    if (empresasSnap.empty) return;
    const empresaId = empresasSnap.docs[0].id;

    console.log(`Inspecting Component Types for Empresa: ${empresaId}`);

    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposComponente').get();

    console.log(`Found ${tiposSnap.size} component types.`);

    tiposSnap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`\nID: ${doc.id}`);
        console.log(`Name: ${data.nombre} / ${data.nombreNormalizado}`);
        console.log(`Defaults: ${data.elementosDefault ? data.elementosDefault.length : 0} items`);
        if (data.elementosDefault && data.elementosDefault.length > 0) {
            console.log(` - Items: ${data.elementosDefault.map(e => e.nombre).join(', ')}`);
        }
    });
}

run().catch(console.error);
