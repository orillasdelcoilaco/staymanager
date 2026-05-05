const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('../../serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function agregarCampoIdAPropiedades() {
    console.log('🔧 Agregando campo "id" a todos los documentos de propiedades...\n');

    try {
        // Obtener TODAS las propiedades usando collection group
        const propSnapshot = await db.collectionGroup('propiedades').get();

        console.log(`📊 Total de propiedades encontradas: ${propSnapshot.size}\n`);

        if (propSnapshot.empty) {
            console.log('❌ No se encontraron propiedades en la base de datos');
            return;
        }

        let actualizadas = 0;
        let yaExistian = 0;
        let errores = 0;

        // Procesar en lotes de 500 (límite de Firestore batch)
        const batchSize = 500;
        let batch = db.batch();
        let operacionesEnBatch = 0;

        for (const doc of propSnapshot.docs) {
            const data = doc.data();

            // Si ya tiene el campo 'id' y coincide con el document ID, skip
            if (data.id === doc.id) {
                yaExistian++;
                continue;
            }

            // Agregar el campo 'id' con el valor del document ID
            batch.update(doc.ref, { id: doc.id });
            operacionesEnBatch++;
            actualizadas++;

            // Si llegamos al límite del batch, ejecutar y crear uno nuevo
            if (operacionesEnBatch >= batchSize) {
                try {
                    await batch.commit();
                    console.log(`✅ Batch de ${operacionesEnBatch} documentos actualizado`);
                    batch = db.batch();
                    operacionesEnBatch = 0;
                } catch (error) {
                    console.error(`❌ Error en batch: ${error.message}`);
                    errores += operacionesEnBatch;
                    batch = db.batch();
                    operacionesEnBatch = 0;
                }
            }
        }

        // Ejecutar el último batch si tiene operaciones pendientes
        if (operacionesEnBatch > 0) {
            try {
                await batch.commit();
                console.log(`✅ Último batch de ${operacionesEnBatch} documentos actualizado`);
            } catch (error) {
                console.error(`❌ Error en último batch: ${error.message}`);
                errores += operacionesEnBatch;
            }
        }

        console.log('\n📈 Resumen de la migración:');
        console.log(`   ✅ Documentos actualizados: ${actualizadas}`);
        console.log(`   ⏭️  Ya tenían el campo: ${yaExistian}`);
        console.log(`   ❌ Errores: ${errores}`);
        console.log(`   📊 Total procesados: ${propSnapshot.size}`);

        if (actualizadas > 0) {
            console.log('\n✨ Migración completada exitosamente!');
            console.log('   Ahora puedes crear los índices de Firestore.');
        }

    } catch (error) {
        console.error('❌ Error fatal:', error.message);
    }

    process.exit(0);
}

agregarCampoIdAPropiedades();
