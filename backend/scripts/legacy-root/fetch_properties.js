const https = require('https');

const url = 'https://suite-manager.onrender.com/api/public/propiedades';
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
};

console.log(`Fetching properties from ${url}...`);

https.get(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);

        // Buscar cualquier ID válido
        const anyIdMatch = data.match(/"id"\s*:\s*"([^"]+)"/);

        if (anyIdMatch) {
            console.log(`✅ FOUND VALID ID: ${anyIdMatch[1]}`);

            // Buscar su empresa
            const index = anyIdMatch.index;
            const context = data.substring(index, index + 1000);
            const empresaMatch = context.match(/"empresa"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/);
            if (empresaMatch) {
                console.log(`✅ Associated Empresa ID: ${empresaMatch[1]}`);
            }
        } else {
            console.log('❌ No IDs found in response.');
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
