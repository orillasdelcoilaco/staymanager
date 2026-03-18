const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const path = require('path');

// Mock process.env for the service if needed, although service checks it.
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// We need to import the service. 
// Note: Depending on how the service exports/imports, we might need to be careful with dependencies.
// Let's try to require it.
const aiContentService = require('../services/aiContentService');

async function refreshIcons() {
    console.log('🚀 Starting Icon Refresh (AI/Heuristic)...');

    const empresasSnap = await db.collection('empresas').get();

    for (const empresaDoc of empresasSnap.docs) {
        console.log(`\n🏢 Processing ${empresaDoc.data().nombre}...`);
        const assetsRef = empresaDoc.ref.collection('tiposElemento');
        const assetsSnap = await assetsRef.get();

        let updatedCount = 0;

        for (const doc of assetsSnap.docs) {
            const data = doc.data();

            // Criteria: Icon is blue diamond OR property-specific "Toalla" check if user complained about it specifically
            // The user said "tiene un icono de rombo azul".
            if (!data.icono || data.icono === '🔹' || data.nombre.toLowerCase().includes('toalla')) {

                // If it's Toalla and has a diamond (or any icon user dislikes), we force update.
                // But generally we target the diamond.
                if (data.icono !== '🔹' && !data.nombre.toLowerCase().includes('toalla')) {
                    continue;
                }

                console.log(`   🔸 Analyzing: "${data.nombre}" (Current: ${data.icono})`);

                try {
                    // We pass 2nd arg as context, but analisisMetadataActivo takes (nombre, listacategorias)
                    // We don't necessarily need the categories for icon gen, but good to pass invalid list or empty.
                    const existingCategories = [];

                    const result = await aiContentService.analizarMetadataActivo(data.nombre, existingCategories);

                    if (result && result.icon && result.icon !== '🔹') {
                        console.log(`      ✨ Suggestion: ${result.icon} (Cat: ${result.category})`);

                        // Update
                        await doc.ref.update({
                            icono: result.icon,
                            // Optionally update category if it was "Otros" and we found a better one?
                            // User only complained about icons for now, but better category is good too.
                            // Let's stick to Icon to avoid side effects unless it is "OTROS"
                            ...(data.categoria === 'OTROS' || data.categoria === 'SIN_CATEGORIA' ? { categoria: result.category.toUpperCase() } : {})
                        });
                        updatedCount++;
                    } else {
                        console.log(`      ⚠️ No better icon found.`);
                    }

                } catch (err) {
                    console.error(`      ❌ Error analyzing: ${err.message}`);
                }
            }
        }
        console.log(`   ✅ Updated ${updatedCount} assets in this company.`);
    }
}

refreshIcons().then(() => {
    console.log('\nDone.');
    process.exit(0);
});
