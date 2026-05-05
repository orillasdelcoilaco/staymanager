const https = require('https');

const BASE_URL = 'https://suite-manager.onrender.com/api/public';
const PROPERTY_ID = '7lzqGKUxuQK0cttYeH0y'; // ID válido en Render (Empresa: cv1Lb4HLBLvWvSyqYfRW)
const DATES = {
    inicio: '2025-12-20',
    fin: '2025-12-25'
};

function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${path}`;
        const options = {
            method,
            headers: {
                'User-Agent': 'ChatGPT/1.0 (Test Script)', // User-Agent permitido
                'Content-Type': 'application/json'
            }
        };

        console.log(`\n🔵 Testing ${method} ${url}...`);

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    console.log('   Response (raw):', data);
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Error: ${e.message}`);
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    try {
        console.log(`✅ Usando ID: ${PROPERTY_ID}`);

        // 1. Test Disponibilidad
        console.log('\n--- 1. Testing Disponibilidad ---');
        const dispRes = await makeRequest(`/propiedades/${PROPERTY_ID}/disponibilidad?fechaInicio=${DATES.inicio}&fechaFin=${DATES.fin}`);
        console.log('   Result:', dispRes.status === 200 ? '✅ OK' : '❌ FAIL');
        if (dispRes.status !== 200) console.log('   Error:', JSON.stringify(dispRes.data, null, 2));

        // 2. Test Imágenes
        console.log('\n--- 2. Testing Imágenes ---');
        const imgRes = await makeRequest(`/propiedades/${PROPERTY_ID}/imagenes`);
        console.log('   Result:', imgRes.status === 200 ? '✅ OK' : '❌ FAIL');
        if (imgRes.status !== 200) console.log('   Error:', JSON.stringify(imgRes.data, null, 2));

        // 3. Test Cotización
        console.log('\n--- 3. Testing Cotización ---');
        const quoteRes = await makeRequest(`/propiedades/${PROPERTY_ID}/cotizar?fechaInicio=${DATES.inicio}&fechaFin=${DATES.fin}`);
        console.log('   Result:', quoteRes.status === 200 ? '✅ OK' : '❌ FAIL');
        if (quoteRes.status !== 200) console.log('   Error:', JSON.stringify(quoteRes.data, null, 2));

        // 4. Test Reserva (Simulada - solo validación)
        console.log('\n--- 4. Testing Creación Reserva (Validación) ---');
        const bookingBody = {
            propiedadId: PROPERTY_ID,
            fechaInicio: DATES.inicio,
            fechaFin: DATES.fin,
            cliente: {
                nombre: "Test User",
                email: "test@example.com",
                telefono: "+56912345678"
            },
            numeroHuespedes: 2,
            agenteIA: "ChatGPT"
        };
        const bookRes = await makeRequest('/reservas', 'POST', bookingBody);
        console.log('   Result:', bookRes.status === 200 || bookRes.status === 201 ? '✅ OK' : '❌ FAIL');
        if (bookRes.status !== 200 && bookRes.status !== 201) console.log('   Error:', JSON.stringify(bookRes.data, null, 2));
        else console.log('   Propuesta creada:', bookRes.data.data?.propuestaId || bookRes.data.propuestaId);

    } catch (error) {
        console.error('❌ Fatal Error:', error);
    }
}

runTests();
