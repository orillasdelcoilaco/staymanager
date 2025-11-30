const https = require('https');

const BASE_URL = 'https://staymanager-backend.onrender.com/api/public';
const PROPERTY_ID = '7lzqGKUxuQK0cttYeH0y';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function testEndpoints() {
    console.log('🧪 Testing API Pública de Ventas para Agentes IA\n');
    console.log('='.repeat(60));

    // Test 1: Disponibilidad
    console.log('\n📋 Test 1: GET /propiedades/:id/disponibilidad');
    try {
        const url = `${BASE_URL}/propiedades/${PROPERTY_ID}/disponibilidad?fechaInicio=2025-12-20&fechaFin=2025-12-25`;
        const result = await makeRequest(url);
        console.log(`Status: ${result.status}`);
        console.log('Response:', JSON.stringify(result.body, null, 2));
        console.log(result.status === 200 ? '✅ PASS' : '❌ FAIL');
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    // Test 2: Imágenes
    console.log('\n📋 Test 2: GET /propiedades/:id/imagenes');
    try {
        const url = `${BASE_URL}/propiedades/${PROPERTY_ID}/imagenes`;
        const result = await makeRequest(url);
        console.log(`Status: ${result.status}`);
        console.log('Response:', JSON.stringify(result.body, null, 2).substring(0, 500) + '...');
        console.log(result.status === 200 ? '✅ PASS' : '❌ FAIL');
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    // Test 3: Cotización
    console.log('\n📋 Test 3: GET /propiedades/:id/cotizar');
    try {
        const url = `${BASE_URL}/propiedades/${PROPERTY_ID}/cotizar?fechaInicio=2025-12-20&fechaFin=2025-12-25`;
        const result = await makeRequest(url);
        console.log(`Status: ${result.status}`);
        console.log('Response:', JSON.stringify(result.body, null, 2));
        console.log(result.status === 200 ? '✅ PASS' : '❌ FAIL');
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    // Test 4: Crear Reserva
    console.log('\n📋 Test 4: POST /reservas');
    try {
        const url = `${BASE_URL}/reservas`;
        const result = await makeRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ChatGPT/1.0'
            },
            body: {
                propiedadId: PROPERTY_ID,
                fechaInicio: '2025-12-20',
                fechaFin: '2025-12-25',
                cliente: {
                    nombre: 'Juan Pérez Test',
                    email: 'juan.test@example.com',
                    telefono: '+56912345678'
                },
                numeroHuespedes: 4,
                agenteIA: 'ChatGPT',
                notas: 'Reserva de prueba desde script de testing'
            }
        });
        console.log(`Status: ${result.status}`);
        console.log('Response:', JSON.stringify(result.body, null, 2));
        console.log(result.status === 201 ? '✅ PASS' : '❌ FAIL');
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    // Test 5: Rate Limiting
    console.log('\n📋 Test 5: Rate Limiting (4 requests rápidas)');
    try {
        const url = `${BASE_URL}/propiedades/${PROPERTY_ID}/imagenes`;
        for (let i = 1; i <= 4; i++) {
            const result = await makeRequest(url);
            console.log(`Request ${i}: Status ${result.status} ${result.status === 429 ? '(RATE LIMITED)' : ''}`);
            if (i === 4 && result.status === 429) {
                console.log('✅ PASS - Rate limiting funciona');
            }
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Testing completado\n');
}

testEndpoints().catch(console.error);
