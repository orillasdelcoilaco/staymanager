/**
 * Script de verificación para el fix del endpoint /api/public/propiedades
 * 
 * Ejecutar después de que Render complete el despliegue:
 * node verify_api_fix.js
 */

const https = require('https');

const API_URL = 'https://staymanager-backend.onrender.com/api/public/propiedades';

console.log('🔍 Verificando endpoint público de propiedades...\n');
console.log(`📡 URL: ${API_URL}\n`);

https.get(API_URL, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`✅ Status Code: ${res.statusCode}\n`);

        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(data);

                console.log('📊 Respuesta del servidor:');
                console.log('─'.repeat(50));
                console.log(JSON.stringify(response, null, 2));
                console.log('─'.repeat(50));

                if (response.data && response.data.data) {
                    const propiedades = response.data.data;
                    console.log(`\n✅ ÉXITO: Se encontraron ${propiedades.length} propiedades`);

                    if (propiedades.length === 2) {
                        console.log('🎉 PERFECTO: El endpoint devuelve las 2 propiedades esperadas con isListed=true');

                        propiedades.forEach((prop, index) => {
                            console.log(`\n  Propiedad ${index + 1}:`);
                            console.log(`    - ID: ${prop.id}`);
                            console.log(`    - Nombre: ${prop.nombre || 'Sin nombre'}`);
                            console.log(`    - Empresa: ${prop.empresa?.nombre || 'Sin empresa'}`);
                            console.log(`    - Dirección: ${prop.direccion || 'Sin dirección'}`);
                        });
                    } else if (propiedades.length === 0) {
                        console.log('⚠️  ADVERTENCIA: No se encontraron propiedades');
                        console.log('   Posibles causas:');
                        console.log('   - El despliegue aún no se completó');
                        console.log('   - Hay otro filtro bloqueando las propiedades');
                        console.log('   - Las propiedades no tienen isListed=true');
                    } else {
                        console.log(`ℹ️  Se encontraron ${propiedades.length} propiedades (esperábamos 2)`);
                    }
                } else {
                    console.log('⚠️  ADVERTENCIA: Estructura de respuesta inesperada');
                    console.log('   La respuesta no contiene data.data');
                }

            } catch (error) {
                console.error('❌ ERROR: No se pudo parsear la respuesta JSON');
                console.error('   Respuesta recibida:', data);
            }
        } else {
            console.error(`❌ ERROR: Status code ${res.statusCode}`);
            console.error('   Respuesta:', data);
        }
    });

}).on('error', (error) => {
    console.error('❌ ERROR DE CONEXIÓN:');
    console.error(`   ${error.message}`);
    console.error('\n💡 Posibles causas:');
    console.error('   - Render está redesplegando el servicio');
    console.error('   - El servicio está caído');
    console.error('   - Problemas de red');
    console.error('\n🔄 Intenta ejecutar este script nuevamente en 1-2 minutos');
});
