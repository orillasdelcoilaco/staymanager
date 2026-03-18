const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const OLD_IDS = [
    'GiVSpcWYzx6QGSJRVIIo',
    'cabana2',
    'aT1LIuD5II0Bg6lZKh0z',
    '9Dz4HR1AWSVKEeIp8sbx',
    'cabana8',
    'cabana9',
    '1dA2PtEzWW3ovgWwcXnG'
];

async function verify() {
    console.log('🔍 Verifying Migration...');
    const empresasSnap = await db.collection('empresas').get();

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        const nombre = empresaDoc.data().nombre;
        console.log(`\n🏢 Company: ${nombre} (${empresaId})`);

        // Check Properties
        const propsSnap = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
        console.log(`   📂 Found ${propsSnap.size} properties.`);

        propsSnap.forEach(doc => {
            if (OLD_IDS.includes(doc.id)) {
                console.error(`      ❌ Alert! Old Property ID still exists: ${doc.id}`);
            } else {
                // console.log(`      ✅ Property: ${doc.id}`);
            }
        });

        // Check Reservas References
        console.log('   Checking Reservas for old references...');
        let badReservas = 0;
        const reservasSnap = await db.collection('empresas').doc(empresaId).collection('reservas').get();
        reservasSnap.forEach(doc => {
            const data = doc.data();
            if (OLD_IDS.includes(data.alojamientoId)) {
                console.error(`      ❌ Bad Reference in Reserva ${doc.id}: alojamientoId = ${data.alojamientoId}`);
                badReservas++;
            }
        });
        if (badReservas === 0) console.log('      ✅ All Reservas references look clean.');

        // Check Tarifas
        console.log('   Checking Tarifas for old references...');
        let badTarifas = 0;
        const tarifasSnap = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
        tarifasSnap.forEach(doc => {
            const data = doc.data();
            if (OLD_IDS.includes(data.alojamientoId)) {
                console.error(`      ❌ Bad Reference in Tarifa ${doc.id}: alojamientoId = ${data.alojamientoId}`);
                badTarifas++;
            }
        });
        if (badTarifas === 0) console.log('      ✅ All Tarifas references look clean.');
    }
}

verify().then(() => process.exit(0));
