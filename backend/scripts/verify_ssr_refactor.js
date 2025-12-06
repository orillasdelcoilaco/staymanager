// backend/scripts/verify_ssr_refactor.js
const admin = require('firebase-admin');
const { crearPropiedad } = require('../services/propiedadesService');
const { obtenerPropiedadPorId } = require('../services/publicWebsiteService');

// Configuración Mock de Firebase (o conexión real si es seguro)
// Para este script, asumiremos que se ejecuta en el entorno donde admin ya está inicializado o lo inicializamos aquí si es local.
// NOTA: Este script requiere credenciales reales o emulador.
// Si no podemos ejecutarlo, la verificación será manual/visual.

if (!admin.apps.length) {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function runTest() {
    const empresaId = 'test-empresa-ssr'; // ID de prueba

    console.log("--- INICIO TEST REFACTOR SSR ---");

    // 1. Crear Propiedad (Write Logic)
    const datosPropiedad = {
        nombre: "Cabaña Test Refactor",
        capacidad: 4,
        descripcion: "Una cabaña de prueba para verificar subcolecciones.",
        componentes: [
            { tipo: "Dormitorio", nombre: "Dormitorio Principal", elementos: [{ nombre: "Cama King", cantidad: 1 }] },
            { tipo: "Baño", nombre: "Baño Completo", elementos: [] }
        ],
        amenidades: [
            { label: "Wifi", tipo: "wifi" },
            { label: "Tinaja", tipo: "tinaja" }
        ]
    };

    console.log("1. Creando propiedad...");
    const nuevaPropiedad = await crearPropiedad(db, empresaId, datosPropiedad);
    console.log(`   > Propiedad creada con ID: ${nuevaPropiedad.id}`);

    // 2. Verificar Subcolecciones (Directo Firestore)
    const propRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(nuevaPropiedad.id);
    const compsSnap = await propRef.collection('componentes').get();
    const amensSnap = await propRef.collection('amenidades').get();

    console.log(`   > Subcolección 'componentes': ${compsSnap.size} documentos (Esperado: 2)`);
    console.log(`   > Subcolección 'amenidades': ${amensSnap.size} documentos (Esperado: 2)`);

    if (compsSnap.size !== 2 || amensSnap.size !== 2) {
        console.error("❌ FALLO: Las subcolecciones no se crearon correctamente.");
    } else {
        console.log("✅ Subcolecciones creadas correctamente.");
    }

    // 3. Leer Propiedad (Read Logic - SSR)
    console.log("2. Leyendo propiedad con servicio SSR...");
    const propiedadSSR = await obtenerPropiedadPorId(db, empresaId, nuevaPropiedad.id);

    console.log(`   > Nombre: ${propiedadSSR.nombre}`);
    console.log(`   > Componentes leídos: ${propiedadSSR.componentes.length}`);
    console.log(`   > Amenidades leídas: ${propiedadSSR.amenidades.length}`);

    if (propiedadSSR.componentes.length === 2 && propiedadSSR.amenidades.length === 2) {
        console.log("✅ Lectura SSR exitosa (Subcolecciones integradas).");
    } else {
        console.error("❌ FALLO: La lectura SSR no recuperó los datos de subcolecciones.");
    }

    // Limpieza
    console.log("3. Limpiando datos de prueba...");
    await propRef.delete(); // Nota: Esto no borra subcolecciones automáticamente en Firestore, pero para el test basta.
    console.log("--- FIN TEST ---");
}

runTest().catch(console.error);
