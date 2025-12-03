const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixPrueba1() {
    console.log('Buscando empresa con nombre "prueba1" para corregir...');
    const qName = db.collection('empresas').where('nombre', '==', 'prueba1');
    const snapName = await qName.get();

    if (!snapName.empty) {
        const doc = snapName.docs[0];
        console.log(`✅ Empresa encontrada: ${doc.id}`);

        const currentData = doc.data();
        const websiteSettings = currentData.websiteSettings || {};

        if (websiteSettings.subdomain === 'prueba1') {
            console.log('⚠️ El subdominio ya es correcto.');
        } else {
            console.log('🛠️ Actualizando websiteSettings.subdomain a "prueba1"...');
            await db.collection('empresas').doc(doc.id).update({
                'websiteSettings.subdomain': 'prueba1',
                'websiteSettings.domain': 'prueba1.suitemanager.com' // También seteamos el dominio completo por si acaso
            });
            console.log('✅ Actualización completada.');
        }
    } else {
        console.log('❌ NO se encontró ninguna empresa con nombre "prueba1". Creándola...');
        // Opcional: Crear si no existe, pero mejor avisar.
        const newRef = db.collection('empresas').doc();
        await newRef.set({
            nombre: 'prueba1',
            websiteSettings: {
                subdomain: 'prueba1',
                domain: 'prueba1.suitemanager.com'
            },
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Empresa "prueba1" creada con ID: ${newRef.id}`);
    }
}

fixPrueba1().catch(console.error);
