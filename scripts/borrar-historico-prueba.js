/**
 * borrar-historico-prueba.js
 *
 * Elimina TODAS las reservas y transacciones con origen === 'historico'
 * de la empresa especificada. Usar solo para limpiar importaciones de prueba.
 *
 * Uso:
 *   node scripts/borrar-historico-prueba.js <empresaId>
 */

const path = require('path');

let serviceAccount;
try {
    serviceAccount = require('/etc/secrets/serviceAccountKey.json');
} catch {
    serviceAccount = require(path.join(__dirname, '../backend/serviceAccountKey.json'));
}

const admin = require(path.join(__dirname, '../backend/node_modules/firebase-admin'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function borrarHistorico(empresaId) {
    if (!empresaId) {
        console.error('Uso: node scripts/borrar-historico-prueba.js <empresaId>');
        process.exit(1);
    }

    console.log(`\n🗑️  Borrando registros históricos de empresa: ${empresaId}\n`);

    // 1. Reservas con origen === 'historico'
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const resSnap = await reservasRef.where('origen', '==', 'historico').get();
    console.log(`   Reservas encontradas: ${resSnap.size}`);

    // 2. Transacciones con origen === 'historico'
    const transRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const transSnap = await transRef.where('origen', '==', 'historico').get();
    console.log(`   Transacciones encontradas: ${transSnap.size}`);

    if (resSnap.size === 0 && transSnap.size === 0) {
        console.log('\n✅ No hay nada que borrar.');
        process.exit(0);
    }

    // Borrar en batches de 500
    const deleteBatch = (docs) => {
        const chunks = [];
        for (let i = 0; i < docs.length; i += 500) chunks.push(docs.slice(i, i + 500));
        return Promise.all(chunks.map(chunk => {
            const b = db.batch();
            chunk.forEach(doc => b.delete(doc.ref));
            return b.commit();
        }));
    };

    await deleteBatch(resSnap.docs);
    await deleteBatch(transSnap.docs);

    console.log(`\n✅ Eliminados: ${resSnap.size} reservas, ${transSnap.size} transacciones.\n`);
    process.exit(0);
}

borrarHistorico(process.argv[2]).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
