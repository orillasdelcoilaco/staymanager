const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001/api/public';

async function testChatGPTSimulation() {
    console.log("🤖 Iniciando Simulación de ChatGPT (Integration Test)...");

    // 0. Diagnóstico de Datos
    console.log("\n0. Accion: GET /propiedades/debug");
    try {
        const resDebug = await fetch(`${BASE_URL}/propiedades/debug`);
        if (resDebug.ok) {
            const jsonDebug = await resDebug.json();
            const fs = require('fs');
            fs.writeFileSync(require('path').join(__dirname, '../../../local/backend/debug_data.json'), JSON.stringify(jsonDebug, null, 2));
            console.log("DEBUG DATA saved to debug_data.json");
        } else {
            console.warn("⚠️ Debug endpoint failed (404/500). Running in prod?");
        }
    } catch (e) { console.warn("Debug fetch error:", e.message); }

    // 1. Simular búsqueda "Busco una cabaña..."
    console.log("\n1. Accion: GET /propiedades (Búsqueda General)");
    try {
        const resList = await fetch(`${BASE_URL}/propiedades`);
        if (!resList.ok) throw new Error(`Status ${resList.status}`);
        const jsonList = await resList.json();
        const fs = require('fs');
        fs.writeFileSync(require('path').join(__dirname, '../../../local/backend/debug_result.json'), JSON.stringify({
            type: typeof jsonList,
            isArray: Array.isArray(jsonList),
            data: jsonList
        }, null, 2));

        // Adaptar a la estructura real (meta/data)

        // Adaptar a la estructura real (meta/data -> data.data)
        const rootData = jsonList.data || {};
        const items = rootData.data || [];

        console.log(`✅ Respuesta OK. Items encontrados: ${items.length}`);

        if (items.length === 0) {
            console.warn("⚠️ No hay propiedades para probar el detalle (Lista vacía).");
            console.warn("⚠️ Pero la API responde correctamente (Integration Alive).");
            return;
        }

        // 3. Test de Búsqueda (Reproducción de Bug)
        console.log("\n3. Testing Search Filters (Pucón vs Pucon)");

        const terms = ["Pucón", "Pucon"];
        for (const term of terms) {
            const url = `${BASE_URL}/propiedades?ubicacion=${encodeURIComponent(term)}`;
            console.log(`   Search: ${term} -> ${url}`);
            const resSearch = await fetch(url);
            const jsonSearch = await resSearch.json();
            const results = (jsonSearch.data && jsonSearch.data.data) ? jsonSearch.data.data : [];
            console.log(`   Result: ${results.length} properties found.`);
            if (results.length === 0) console.warn(`   ⚠️ WARNING: Failed to find properties for '${term}'`);
        }

        const idPrueba = items[0].id;
        console.log(`🎯 Seleccionando Propiedad ID: ${idPrueba} para detalle.`);

        // 2. Simular pregunta "Que comodidades tiene...?"
        console.log(`\n2. Accion: GET /propiedad/${idPrueba} (Detalle)`);
        const resDetail = await fetch(`${BASE_URL}/propiedad/${idPrueba}`);
        if (!resDetail.ok) throw new Error(`Status ${resDetail.status}`);
        const jsonDetail = await resDetail.json();
        const detail = jsonDetail.data || jsonDetail;

        console.log("✅ Detalle Recibido.");
        console.log(`   - Nombre: ${detail.nombre}`);
        console.log(`   - Descripcion (AI generated?): ${detail.descripcion ? 'YES' : 'NO'}`);
        console.log(`   - Amenidades/Componentes detectados: ${detail.componentes ? detail.componentes.length : 0}`);

        console.log("\n🎉 [EXITO] La integración pública responde correctamente.");

    } catch (error) {
        console.error("❌ FALLO LA SIMULACION:", error.message);
        console.error("Asegúrate de que el servidor esté corriendo en el puerto 3001.");
        process.exit(1);
    }
}

testChatGPTSimulation();
