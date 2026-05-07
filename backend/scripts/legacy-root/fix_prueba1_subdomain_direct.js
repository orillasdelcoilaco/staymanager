const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixSubdomainDirect() {
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    console.log(`🔧 Corrigiendo subdominio (DIRECTO) para empresa ID: ${empresaId}`);

    try {
        const empresaRef = db.collection('empresas').doc(empresaId);

        // Actualización directa usando notación de puntos para no sobrescribir todo el objeto websiteSettings
        await empresaRef.update({
            'websiteSettings.general.subdomain': 'prueba1',
            'websiteSettings.general.domain': 'prueba1.rezerva.cl',
            'websiteSettings.subdomain': 'prueba1', // Campo raíz para indexación rápida
            'websiteSettings.domain': 'prueba1.rezerva.cl' // Campo raíz para indexación rápida
        });

        console.log('✅ Subdominio actualizado a "prueba1" exitosamente (Método Directo).');
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
    }
}

fixSubdomainDirect().catch(console.error);
