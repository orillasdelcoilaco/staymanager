const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Gemini Provider Adapter
 */
class GeminiProvider {
    constructor(config) {
        if (!config.apiKey) {
            console.warn("⚠️ [GeminiProvider] No API Key provided.");
            this.model = null;
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(config.apiKey);
            this.modelName = config.model || "gemini-2.0-flash"; // Default to 2.0-flash
            this.model = this.genAI.getGenerativeModel({ model: this.modelName });
            console.log(`✅ [GeminiProvider] Initialized with model: ${this.modelName}`);
        } catch (error) {
            console.error("❌ [GeminiProvider] Init Error:", error);
            this.model = null;
        }
    }

    /**
     * Generates a JSON response from a text prompt.
     * @param {string} promptText 
     * @returns {Promise<object|null>} Parsed JSON or null if failed.
     */
    async generateJSON(promptText) {
        if (!this.model) {
            console.error("❌ [GeminiProvider] Model not initialized.");
            return null;
        }

        try {
            console.log(`[GeminiProvider] 🚀 Generating content...`);
            const result = await this.model.generateContent(promptText);
            const response = await result.response;
            const text = response.text();

            console.log(`[GeminiProvider] ✅ Response received (${text.length} chars).`);

            // Clean Markdown code blocks
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                return JSON.parse(cleanedText);
            } catch (parseError) {
                console.warn("⚠️ [GeminiProvider] JSON Parse failed. Raw text:", text);
                // Attempt simplistic fix if needed, or just fail
                return null;
            }

        } catch (error) {
            console.error("❌ [GeminiProvider] Generate Error:", error.message);
            return null;
        }
    }
}

module.exports = GeminiProvider;
