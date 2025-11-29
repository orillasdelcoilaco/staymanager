const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function inspectData() {
    try {
        const empresasSnapshot = await db.collection('empresas').get();
        if (empresasSnapshot.empty) {
            console.log('No empresas found.');
            return;
        }

        for (const empresaDoc of empresasSnapshot.docs) {
            console.log(`\n--- Empresa: ${empresaDoc.id} ---`);
            const propiedadesSnapshot = await empresaDoc.ref.collection('propiedades').get();

            if (propiedadesSnapshot.empty) {
                console.log('No propiedades found for this empresa.');
                continue;
            }

            propiedadesSnapshot.forEach(doc => {
                const data = doc.data();
                console.log(`\nPropiedad: ${data.nombre} (${doc.id})`);
                console.log('Camas:', JSON.stringify(data.camas, null, 2));
                console.log('Equipamiento:', JSON.stringify(data.equipamiento, null, 2));
                console.log('Componentes:', JSON.stringify(data.componentes, null, 2));
            });
        }
    } catch (error) {
        console.error('Error inspecting data:', error);
    }
}

inspectData();
