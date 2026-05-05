const path = require('path');

if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("NO API KEY");
        return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    console.log("Fetching models from:", url.replace(key, 'MASKED'));
    try {
        const res = await fetch(url);
        const data = await res.json();
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, 'models_list.json'), JSON.stringify(data, null, 2));
        console.log("Models written to models_list.json");
    } catch (e) {
        console.error("Error:", e);
    }
}
listModels();
