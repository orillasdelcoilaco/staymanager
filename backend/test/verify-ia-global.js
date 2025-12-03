const axios = require('axios');

async function testEndpoints() {
    console.log('🧪 Iniciando verificación de endpoints IA Global...');
    const baseUrl = 'http://localhost:3005'; // Puerto de prueba

    try {
        // 1. Probar Buscador Global
        console.log('\n🔍 Probando GET /api/public/busqueda-general...');
        try {
            const resSearch = await axios.get(`${baseUrl}/api/public/busqueda-general?destino=Santiago`);
            console.log(`✅ ÉXITO: Status ${resSearch.status}`);
            // console.log('Respuesta:', resSearch.data);
        } catch (e) {
            console.error(`❌ FALLO /busqueda-general: ${e.message}`);
            if (e.response) console.error(`Status: ${e.response.status}`);
        }

        // 2. Probar Configuración de Agente (requiere auth, simularemos o probaremos si la ruta existe al menos)
        // Nota: Como requiere auth, es difícil probar con script simple sin token. 
        // Pero podemos verificar si la ruta está montada intentando acceder y esperando un 401 o 403 en lugar de 404.
        console.log('\n🔍 Probando existencia de GET /api/agent-config (esperando 401/403)...');
        try {
            await axios.get(`${baseUrl}/api/agent-config`);
        } catch (e) {
            if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                console.log(`✅ ÉXITO: La ruta existe y está protegida (${e.response.status}).`);
            } else if (e.response && e.response.status === 404) {
                console.error(`❌ FALLO: La ruta no existe (404).`);
            } else {
                console.error(`⚠️ Resultado inesperado: ${e.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testEndpoints();
