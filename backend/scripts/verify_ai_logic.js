
const admin = require('firebase-admin');
const path = require('path');
const { generarDescripcionAlojamiento, generarMetadataImagen } = require('../services/aiContentService');
// .env is in backend/, this script is in backend/scripts/
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Mock DB setup for service (not strictly needed for aiContentService unless it calls DB)
// aiContentService only calls Gemini API.

async function verifyAI() {
    console.log("--- STARTING AI VERIFICATION ---");

    // Test 1: Description Generation
    console.log("\n1. Testing Description Generation...");
    try {
        const desc = await generarDescripcionAlojamiento(
            "Cabaña rústica con vista al lago", // desc base
            "Cabaña del Lago", // nombre
            "StayManager Holidays", // empresa
            "Pucón, Chile", // ubicacion
            "Cabaña", // tipo
            "Relax y Naturaleza", // marketing
            {
                historia: "Somos una empresa familiar dedicada al descanso.",
                slogan: "Descanso natural.",
                componentes: [{ nombre: "Dormitorio Principal", tipo: "Dormitorio" }]
            }
        );
        console.log("SUCCESS Description Generated:");
        console.log(desc.substring(0, 100) + "...");
    } catch (e) {
        console.error("FAIL Description Generation:", e);
    }

    // Test 2: Image Metadata
    console.log("\n2. Testing Image Metadata Generation...");
    try {
        // Mock buffer (empty) - might trigger error or mock response depending on implementation
        // The service uses generating content with image parts.
        // We'll pass a dummy buffer.
        const dummyBuffer = Buffer.from("dummy data");

        // Note: Real Gemini API will fail with invalid image data, but we want to fail gracefully or hit the mock.
        // If API key is missing, it hits mock.
        const meta = await generarMetadataImagen(
            "StayManager Holidays",
            "Cabaña del Lago",
            "Cabaña rústica",
            "Dormitorio Principal",
            "Dormitorio",
            dummyBuffer
        );
        console.log("SUCCESS Image Metadata:", meta);
    } catch (e) {
        // Expecting some error if API is real and image is fake, but function should return JSON fallback or throw handled error
        console.log("Result (possibly error due to fake image):", e.message);
    }

    console.log("\n--- VERIFICATION FINISHED ---");
}

verifyAI();
