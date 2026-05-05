const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('../../serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarEstructuraPropiedades() {
    console.log('🔍 Verificando estructura de documentos de propiedades...\n');

    try {
        // Obtener una propiedad de ejemplo
        const propSnapshot = await db.collectionGroup('propiedades').limit(1).get();

        if (propSnapshot.empty) {
            console.log('❌ No se encontraron propiedades en la base de datos');
            return;
        }

        const propDoc = propSnapshot.docs[0];
        const propData = propDoc.data();

        console.log('📄 Documento de ejemplo:');
        console.log('   ID del documento:', propDoc.id);
        console.log('   Ruta completa:', propDoc.ref.path);
        console.log('\n📋 Campos disponibles:');
        console.log('   - Tiene campo "id"?:', propData.id ? '✅ Sí' : '❌ No');

        if (propData.id) {
            console.log('   - Valor del campo "id":', propData.id);
            console.log('   - Coincide con document ID?:', propData.id === propDoc.id ? '✅ Sí' : '❌ No');
        }

        console.log('\n   Otros campos relevantes:');
        Object.keys(propData).slice(0, 10).forEach(key => {
            console.log(`   - ${key}: ${typeof propData[key]}`);
        });

        console.log('\n💡 Recomendación para índices:');
        if (propData.id && propData.id === propDoc.id) {
            console.log('   ✅ Usar campo "id" en los índices');
        } else {
            console.log('   ⚠️  NO usar campo "id", usar __name__ en su lugar');
            console.log('   O agregar campo "id" a todos los documentos');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

verificarEstructuraPropiedades();
