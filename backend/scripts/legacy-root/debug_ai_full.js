require('dotenv').config();
const admin = require('firebase-admin');
const { generarEstructuraAlojamiento } = require('../../services/aiContentService');
// Mocking services for creation
const { analizarNuevoTipoConIA, crearTipoComponente } = require('../../services/componentesService');

if (admin.apps.length === 0) {
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// MOCK: obtenerTiposPorEmpresa (Fetch real from DB or Mock?)
// Let's fetch real from DB to be accurate to user's state
async function getTipos(empresaId) {
    const snap = await db.collection('empresas').doc(empresaId).collection('tiposComponente').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function run() {
    const descripcion = "Espectacular casa con vista al rio, dormitorio matrimonial con acceso al baño, otro dormitorio con un camarote y una cama nido, cocina, living, comedor en amplio espacio abierto, chimenea, un baño, terraza con muebles de terraza, parrilla, tinaja privada, estacionamiento para 2 autos";
    const empresaId = "test-empresa-debug"; // Use same as verify script

    console.log("--- 1. Fetching Tipos ---");
    const tiposDisponibles = await getTipos(empresaId);
    console.log(`Encontrados ${tiposDisponibles.length} tipos en DB.`);

    console.log("--- 2. Calling AI ---");
    const dataAI = await generarEstructuraAlojamiento(descripcion, tiposDisponibles);
    console.log("AI Response RAW:", JSON.stringify(dataAI, null, 2));

    const componentes = dataAI.componentes || [];

    console.log("--- 3. Running Creation Logic (Simulation) ---");
    for (const comp of componentes) {
        console.log(`\nProcesando: ${comp.nombre} (TipoID: ${comp.tipoId})`);

        if (!comp.tipoId && !comp.sugerenciaNuevoTipo) {
            comp.sugerenciaNuevoTipo = comp.nombre; // Fallback logic
            console.log("  > Fallback aplicado: Sugerencia = nombre");
        }

        if ((comp.crearNuevo || !comp.tipoId) && comp.sugerenciaNuevoTipo) {
            console.log(`  > CREATION TRIGGERED for: ${comp.sugerenciaNuevoTipo}`);

            // Replicating aiRoutes logic
            const analisis = await analizarNuevoTipoConIA(comp.sugerenciaNuevoTipo);
            console.log("  > Analisis:", analisis.nombreNormalizado);

            // Create in DB
            const nuevoTipo = await crearTipoComponente(db, empresaId, analisis);
            console.log("  > Created ID:", nuevoTipo.id);

            // Assign
            comp.tipoId = nuevoTipo.id;
            comp.tipo = nuevoTipo.nombreNormalizado;
        } else {
            console.log("  > NO Creation triggered.");
        }
    }

    console.log("\n--- FINAL STRUCTURE ---");
    console.log(JSON.stringify(componentes, null, 2));
}

run();
