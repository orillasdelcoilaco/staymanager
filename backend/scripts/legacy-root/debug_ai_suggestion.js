require('dotenv').config();
const admin = require('firebase-admin');
const { generarEstructuraAlojamiento } = require('../../services/aiContentService');
// Mocking services for creation
const { analizarNuevoTipoConIA } = require('../../services/componentesService');

if (admin.apps.length === 0) {
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function getTipos(empresaId) {
    const snap = await db.collection('empresas').doc(empresaId).collection('tiposComponente').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function run() {
    const descripcion = "Cabaña con dormitorio matrimonial, cocina, living, tinaja caliente y terraza."; // Inputs "Tinaja" which likely doesn't exist
    const empresaId = "test-empresa-debug";

    console.log("--- 1. Fetching Tipos ---");
    const tiposDisponibles = await getTipos(empresaId);
    console.log(`Encontrados ${tiposDisponibles.length} tipos.`);

    console.log("--- 2. Calling AI ---");
    const dataAI = await generarEstructuraAlojamiento(descripcion, tiposDisponibles);

    // Simulating aiRoutes.js logic
    const componentes = dataAI.componentes || [];
    const suggestedNewTypes = [];

    console.log("--- 3. Running Suggestion Logic (Simulation) ---");
    for (const comp of componentes) {
        // Fallback logic
        if (!comp.tipoId && !comp.sugerenciaNuevoTipo) {
            comp.sugerenciaNuevoTipo = comp.nombre;
        }

        if ((comp.crearNuevo || !comp.tipoId) && comp.sugerenciaNuevoTipo) {
            console.log(`  > SUGGESTION DETECTED: ${comp.sugerenciaNuevoTipo}`);

            // Check duplicates
            const yaSugerido = suggestedNewTypes.find(s => s.nombreNormalizado === comp.sugerenciaNuevoTipo);

            if (!yaSugerido) {
                const analisis = await analizarNuevoTipoConIA(comp.sugerenciaNuevoTipo);
                suggestedNewTypes.push(analisis);
                comp.tipo = analisis.nombreNormalizado;
                comp.icono = analisis.icono;
            } else {
                comp.tipo = yaSugerido.nombreNormalizado;
                comp.icono = yaSugerido.icono;
            }
        }
    }

    console.log("\n--- FINAL RESPONSE STRUCTURE ---");
    console.log("Componentes:", componentes.length);
    console.log("Sugerencias:", suggestedNewTypes.length);
    console.log(JSON.stringify({ componentes, suggestedNewTypes }, null, 2));
}

run();
