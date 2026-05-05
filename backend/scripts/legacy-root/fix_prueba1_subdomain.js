const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');
const { actualizarDetallesEmpresa } = require('../../services/empresaService');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixSubdomain() {
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    console.log(`🔧 Corrigiendo subdominio para empresa ID: ${empresaId}`);

    try {
        // Usamos el servicio existente que ya tiene la lógica de sincronización
        await actualizarDetallesEmpresa(db, empresaId, {
            websiteSettings: {
                general: {
                    subdomain: 'prueba1'
                }
            }
        });
        console.log('✅ Subdominio actualizado a "prueba1" exitosamente.');
    } catch (error) {
        console.error('❌ Error al actualizar:', error);
    }
}

fixSubdomain().catch(console.error);
