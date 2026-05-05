const admin = require('firebase-admin');
const { crearPropiedad } = require('../../services/propiedadesService');
const serviceAccount = require('../../serviceAccountKey.json');

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    console.log("--- Testing Property Creation Fix ---");
    const empresaId = 'test-empresa-debug';
    const nombre = 'Cabaña de Prueba 1';

    try {
        const res = await crearPropiedad(db, empresaId, {
            nombre: nombre,
            descripcion: 'Descripción de prueba generada por script de validación.',
            capacidad: 0, // Probando que acepte 0
            componentes: [],
            amenidades: []
        });

        console.log("✅ ÉXITO: Propiedad creada.");
        console.log("   - ID Generado:", res.id); // Debería ser 'cabanadeprueba1' o similar
        console.log("   - Capacidad Guardada:", res.capacidad); // Debería ser 0
        console.log("   - Nombre:", res.nombre);

        // Limpieza (Opcional, pero bueno para no dejar basura)
        await db.collection('empresas').doc(empresaId).collection('propiedades').doc(res.id).delete();
        console.log("🧹 Propiedad de prueba eliminada.");

    } catch (e) {
        console.error("❌ FALLO:", e.message);
        process.exit(1);
    }
}

run().catch(console.error);
