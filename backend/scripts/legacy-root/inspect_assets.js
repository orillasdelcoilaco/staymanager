
const admin = require('firebase-admin');
const fs = require('fs');

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
    let output = "";

    // Get first company
    const empresasSnap = await db.collection('empresas').limit(1).get();
    if (empresasSnap.empty) return;
    const empresaId = empresasSnap.docs[0].id;

    // Get 'tiposElemento'
    const tiposSnap = await db.collection('empresas').doc(empresaId).collection('tiposElemento').get();

    output += `Found ${tiposSnap.size} element types.\n`;

    // Dump a few relevant ones (Cama, Sofa)
    tiposSnap.docs.forEach(doc => {
        const data = doc.data();
        const name = (data.nombre || "").toLowerCase();

        if (name.includes('cama') || name.includes('sofa') || name.includes('velador')) {
            output += `\nID: ${doc.id}\n`;
            output += `Name: ${data.nombre}\n`;
            output += `ALL DATA: ${JSON.stringify(data, null, 2)}\n`;
        }
    });

    fs.writeFileSync('d:/pmeza/Desarrollos Render/staymanager/backend/asset_schema_dump.txt', output, 'utf8');
    console.log("Dump written to asset_schema_dump.txt");
}

run().catch(console.error);
