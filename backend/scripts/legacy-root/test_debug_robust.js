const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const GeminiProvider = require('../../services/ai_providers/geminiProvider');

async function test() {
    console.log("--- DEBUG START ---");

    // 1. Check Env
    const apiKey = process.env.GEMINI_API_KEY;
    console.log(`[Env] GEMINI_API_KEY present: ${!!apiKey}`);
    if (apiKey) console.log(`[Env] Key length: ${apiKey.length}`);

    // 2. Initialize Provider
    const config = { apiKey: apiKey, model: "gemini-2.0-flash" };
    console.log("[Init] Creating GeminiProvider...");
    const provider = new GeminiProvider(config);

    if (!provider.model) {
        console.error("[Error] Provider model is null. Init failed.");
        return;
    }

    // 3. Test Generate
    const prompt = `
        Responde SOLO JSON: {"status": "ok", "icon": "🌮"}
    `;

    console.log("[Test] Sending simple prompt...");
    try {
        const result = await provider.generateJSON(prompt);
        console.log("[Result] Raw JSON object:", JSON.stringify(result));
    } catch (e) {
        console.error("[Error] Generation failed:", e);
    }
    console.log("--- DEBUG END ---");
}

test();
