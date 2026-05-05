const https = require('https');

const url = 'https://suite-manager.onrender.com/api/public/version';
const options = {
    headers: {
        'User-Agent': 'ChatGPT/1.0 (Test Script)'
    }
};

console.log(`Checking version at ${url}...`);

https.get(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log('Version Info:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response (raw):', data);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
