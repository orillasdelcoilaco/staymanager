const axios = require('axios');

async function testEndpoints() {
    console.log('🧪 Iniciando verificación de endpoints ChatGPT Actions...');
    const baseUrl = 'http://localhost:3005'; // Puerto de prueba

    try {
        // 1. GET /ai/buscar-empresa
        console.log('\n🔍 Probando GET /ai/buscar-empresa...');
        try {
            const res = await axios.get(`${baseUrl}/ai/buscar-empresa?q=prueba`);
            console.log(`✅ ÉXITO: Status ${res.status}`);
        } catch (e) {
            console.error(`❌ FALLO /ai/buscar-empresa: ${e.message}`);
            if (e.response) console.error(`Status: ${e.response.status}`);
        }

        // 2. GET /api/public/busqueda-general
        console.log('\n🔍 Probando GET /api/public/busqueda-general...');
        try {
            const res = await axios.get(`${baseUrl}/api/public/busqueda-general`);
            console.log(`✅ ÉXITO: Status ${res.status}`);
        } catch (e) {
            console.error(`❌ FALLO /api/public/busqueda-general: ${e.message}`);
        }

        // 3. GET /api/agent-config
        console.log('\n🔍 Probando GET /api/agent-config...');
        // Necesitamos un ID de empresa válido o al menos probar que responde 404 si no existe, pero no 404 de ruta
        try {
            const res = await axios.get(`${baseUrl}/api/agent-config?empresa_id=test`);
            console.log(`✅ ÉXITO: Status ${res.status} (aunque sea 404 de empresa, la ruta existe)`);
        } catch (e) {
            if (e.response && e.response.status === 404 && e.response.data.error === "Empresa no encontrada") {
                console.log(`✅ ÉXITO: La ruta existe y manejó el ID inválido correctamente.`);
            } else {
                console.error(`❌ FALLO /api/agent-config: ${e.message}`);
                if (e.response) console.error(`Status: ${e.response.status}, Data:`, e.response.data);
            }
        }

        // 4. GET /api/disponibilidad
        console.log('\n🔍 Probando GET /api/disponibilidad...');
        try {
            const res = await axios.get(`${baseUrl}/api/disponibilidad?checkin=2025-01-01&checkout=2025-01-05&adultos=2`);
            console.log(`✅ ÉXITO: Status ${res.status}`);
        } catch (e) {
            console.error(`❌ FALLO /api/disponibilidad: ${e.message}`);
        }

        // 5. GET /api/alojamientos/detalle
        console.log('\n🔍 Probando GET /api/alojamientos/detalle...');
        try {
            // Probamos sin ID para ver si responde 400 o 404 del controller, confirmando ruta
            await axios.get(`${baseUrl}/api/alojamientos/detalle`);
        } catch (e) {
            // Si responde algo distinto a "Cannot GET", la ruta existe
            if (e.response && e.response.status !== 404) {
                console.log(`✅ ÉXITO: Ruta existe (Status ${e.response.status})`);
            } else if (e.response && e.response.status === 404 && e.response.data.error) {
                console.log(`✅ ÉXITO: Ruta existe y devolvió error controlado.`);
            } else {
                console.error(`⚠️ Posible fallo /api/alojamientos/detalle: ${e.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testEndpoints();
