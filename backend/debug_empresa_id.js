const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkEmpresa(id) {
    console.log(`🔍 Buscando empresa con ID: ${id}`);

    // 1. Buscar en colección 'empresas'
    const doc = await db.collection('empresas').doc(id).get();
    if (doc.exists) {
        console.log('✅ Encontrada en collection "empresas":', doc.data().nombre || doc.data().razonSocial);
        return;
    } else {
        console.log('❌ No encontrada en collection "empresas"');
    }

    // 2. Listar primeros 5 IDs reales para comparar
    console.log('\n📋 Listando primeras 5 empresas disponibles:');
    const snapshot = await db.collection('empresas').limit(5).get();
    snapshot.forEach(doc => {
        console.log(`- ID: ${doc.id} | Nombre: ${doc.data().nombre || doc.data().razonSocial || 'Sin nombre'}`);
    });
}

const targetId = '7lzqGKUxuQK0cttYeH0y';
checkEmpresa(targetId).catch(console.error);
