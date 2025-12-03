const axios = require('axios');

async function testLegalPages() {
    console.log('🧪 Iniciando verificación de páginas legales...');
    const baseUrl = 'http://localhost:3005';

    try {
        // 1. GET /legal/privacy
        console.log('\n🔍 Probando GET /legal/privacy...');
        try {
            const res = await axios.get(`${baseUrl}/legal/privacy`);
            if (res.status === 200 && res.data.includes('Política de Privacidad de SuiteManager')) {
                console.log('✅ ÉXITO: Página de Privacidad carga correctamente.');
            } else {
                console.error('❌ FALLO: Status incorrecto o contenido no encontrado.');
            }
        } catch (e) {
            console.error(`❌ FALLO /legal/privacy: ${e.message}`);
        }

        // 2. GET /legal/terms
        console.log('\n🔍 Probando GET /legal/terms...');
        try {
            const res = await axios.get(`${baseUrl}/legal/terms`);
            if (res.status === 200 && res.data.includes('Términos y Condiciones de Uso de SuiteManager')) {
                console.log('✅ ÉXITO: Página de Términos carga correctamente.');
            } else {
                console.error('❌ FALLO: Status incorrecto o contenido no encontrado.');
            }
        } catch (e) {
            console.error(`❌ FALLO /legal/terms: ${e.message}`);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

testLegalPages();
