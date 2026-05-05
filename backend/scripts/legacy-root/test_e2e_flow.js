const admin = require('firebase-admin');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load Env
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Service Imports
const { generarPlanFotos } = require('../../services/propiedadLogicService');
const { generarMetadataImagen } = require('../../services/aiContentService');
const { obtenerPropiedadPorId } = require('../../services/propiedadesService');

// Verify Service Account
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !admin.apps.length) {
    // If running locally without GOOGLE_APPLICATION_CREDENTIALS env, this might fail unless default app is somehow set up?
    // The existing code uses admin.initializeApp() in index.js.
    // I will try to piggyback on existing admin if I can, but usually scripts need their own init.
    // Assuming the user has credentials or I'll catch the error.
    try {
        const serviceAccount = require('../../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.warn("⚠️ Could not load serviceAccountKey.json. DB access might fail.", e.message);
    }
} else if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function runTest() {
    console.log("--- INICIANDO TEST E2E SIMULADO ---");

    const propiedadId = '7lzqGKUxuQK0cttYeH0y'; // ID conocido del usuario
    const empresaId = 'orillasdelcoilaco'; // Necesito el ID de empresa. Asumiré este o buscaré.

    // 1. Fetch Property
    console.log(`\n1. Buscando propiedad: ${propiedadId}...`);
    // I need to find the company ID first if I don't know it.
    // Or scan collections?
    // Let's try to list companies to find the property.
    let snapshot = await db.collection('empresas').get();
    let foundProp = null;
    let foundEmpresaId = null;

    for (const doc of snapshot.docs) {
        const pRef = await db.collection('empresas').doc(doc.id).collection('propiedades').doc(propiedadId).get();
        if (pRef.exists) {
            foundProp = pRef.data();
            foundEmpresaId = doc.id;
            break;
        }
    }

    if (!foundProp) {
        console.error("❌ Propiedad no encontrada en ninguna empresa.");
        return;
    }
    console.log(`✅ Propiedad encontrada en empresa: ${foundEmpresaId}`);
    console.log(`   Nombre: ${foundProp.nombre}`);
    console.log(`   Componentes: ${foundProp.componentes ? foundProp.componentes.length : 0}`);

    // 2. Generate Photo Plan
    console.log("\n2. Generando Plan de Fotos (Lógica Optimizada)...");
    const plan = generarPlanFotos(foundProp.componentes);
    const primerComponenteId = Object.keys(plan)[0];
    const primerPlan = plan[primerComponenteId];

    console.log(`✅ Plan generado para ${Object.keys(plan).length} componentes.`);
    console.log(`   Ejemplo (${primerComponenteId}):`, JSON.stringify(primerPlan[0], null, 2));

    // Check for excessive items
    let totalShots = 0;
    Object.values(plan).forEach(shots => totalShots += shots.length);
    console.log(`   Total de fotos sugeridas: ${totalShots}`);

    // 3. Simulate Image AI Analysis
    console.log("\n3. Simulando Análisis de Imagen con IA...");
    try {
        // Dummy 1x1 GIF Buffer
        const imageBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        const context = "Foto de la cocina mostrando el refrigerador y mesón.";

        console.log("   Enviando a Gemini...");
        const aiResult = await generarMetadataImagen(
            foundEmpresaId,
            foundProp.nombre,
            foundProp.descripcion || "Cabaña rústica",
            "Cocina",
            "COCINA",
            imageBuffer,
            context
        );

        console.log("✅ Resultado IA:");
        console.log("   Alt Text:", aiResult.altText);
        console.log("   Title:", aiResult.title);

        if (aiResult.altText && !aiResult.altText.includes("Mock")) {
            console.log("   🚀 CONFIRMADO: IA REAL está funcionando.");
        } else {
            console.warn("   ⚠️ ADVERTENCIA: Parece ser respuesta Mock o inválida.");
        }

    } catch (e) {
        console.error("❌ Error en análisis de imagen:", e);
    }
}

runTest().catch(console.error);
