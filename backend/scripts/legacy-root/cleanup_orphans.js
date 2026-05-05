const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// USAGE: node cleanup_orphans.js [delete]
const DELETE_MODE = process.argv[2] === 'delete';

async function cleanupOrphans() {
    try {
        console.log("🧹 Iniciando Limpieza de Datos Huérfanos...");
        if (DELETE_MODE) console.log("⚠️  MODO DESTRUCTIVO ACTIVADO: Se eliminarán los registros huérfanos.");
        else console.log("ℹ️  MODO REPORTE: Use 'node cleanup_orphans.js delete' para borrar.");

        const empresas = await db.collection('empresas').get();

        for (const empresaDoc of empresas.docs) {
            console.log(`\n🏢 Analizando Empresa: ${empresaDoc.data().nombre || empresaDoc.id}...`);
            const empresaId = empresaDoc.id;

            // 1. Obtener Propiedades Válidas
            const propsSnap = await empresaDoc.ref.collection('propiedades').select('nombre').get();
            const validPropIds = new Set(propsSnap.docs.map(d => d.id));
            console.log(`   ✅ ${validPropIds.size} Propiedades válidas encontradas.`);

            // 2. Analizar Tarifas Huérfanas
            const tarifasSnap = await empresaDoc.ref.collection('tarifas').get();
            let tarifasHuérfanas = 0;
            const batchTarifas = db.batch();

            tarifasSnap.forEach(doc => {
                const data = doc.data();
                if (data.alojamientoId && !validPropIds.has(data.alojamientoId)) {
                    tarifasHuérfanas++;
                    console.log(`   ❌ Tarifa Huérfana ${doc.id} (Alojamiento inexistente: ${data.alojamientoId})`);
                    if (DELETE_MODE) batchTarifas.delete(doc.ref);
                }
            });

            if (tarifasHuérfanas > 0) {
                console.log(`   Found ${tarifasHuérfanas} Tarifas huérfanas.`);
                if (DELETE_MODE) {
                    await batchTarifas.commit();
                    console.log(`   🗑️  ${tarifasHuérfanas} Tarifas eliminadas.`);
                }
            } else {
                console.log(`   ✨ Sin Tarifas huérfanas.`);
            }

            // 3. Analizar Reservas Huérfanas (Opcional: Verificar estado o fecha?)
            // Borraremos si apunta a un alojamiento que NO existe.
            const reservasSnap = await empresaDoc.ref.collection('reservas').get();
            let reservasHuérfanas = 0;
            const batchReservas = db.batch();

            reservasSnap.forEach(doc => {
                const data = doc.data();
                if (data.alojamientoId && !validPropIds.has(data.alojamientoId)) {
                    reservasHuérfanas++;
                    console.log(`   ❌ Reserva Huérfana ${doc.id} (Alojamiento inexistente: ${data.alojamientoId})`);
                    if (DELETE_MODE) batchReservas.delete(doc.ref);
                }
            });

            if (reservasHuérfanas > 0) {
                console.log(`   Found ${reservasHuérfanas} Reservas huérfanas.`);
                if (DELETE_MODE) {
                    await batchReservas.commit();
                    console.log(`   🗑️  ${reservasHuérfanas} Reservas eliminadas.`);
                }
            } else {
                console.log(`   ✨ Sin Reservas huérfanas.`);
            }
        }

        console.log("\n✅ Proceso Finalizado.");

    } catch (error) {
        console.error("Error:", error);
    }
}

cleanupOrphans();
