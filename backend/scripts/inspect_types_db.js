const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'test-empresa-debug';

// NOTE: In the user's logs, the empresaId might differ (e.g. "cv1Lb4HLBL...").
// I will try to find the real empresaId from recent properties or user logs if possible, 
// but for now I'll scan ALL empresas or rely on the one I've been using for debug if the user is consistently using that.
// ... Wait, the user logs showed: `[Service] Consultando tipos para empresa: cv1Lb4HLBLvWvSyqYfRW`
// So I MUST use THAT enterprise ID.

const TARGET_EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

async function inspectTypes() {
    console.log(`🚀 Inspecting Types for Enterprise: ${TARGET_EMPRESA_ID}`);

    const snapshot = await db.collection('empresas').doc(TARGET_EMPRESA_ID).collection('tiposComponente').get();

    if (snapshot.empty) {
        console.log("❌ No types found.");
        return;
    }

    console.log(`✅ Found ${snapshot.size} types. Listing details:\n`);

    const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    types.forEach(t => {
        console.log(`[${t.id}]`);
        console.log(`   Nombre Usuario: "${t.nombreUsuario}"`);
        console.log(`   Nombre Norm.:   "${t.nombreNormalizado}"`);
        console.log(`   Icono:          ${t.icono}`);
        console.log(`   Creado:         ${t.fechaCreacion ? t.fechaCreacion.toDate() : 'N/A'}`);
        console.log('------------------------------------------------');
    });
}

inspectTypes().then(() => process.exit(0));
