/**
 * OpenAI-Compatible Provider Adapter
 * Funciona con OpenAI, SiliconFlow, Moonshot, Qwen, y cualquier API compatible con OpenAI.
 * Usa fetch nativo (Node 18+). Sin dependencias adicionales.
 */
class OpenAIProvider {
    constructor(config) {
        if (!config.apiKey) {
            console.warn(`⚠️ [OpenAIProvider] No API Key provided (${config.providerName || 'OpenAI'}).`);
            this.ready = false;
            return;
        }
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-4-turbo';
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
        this.providerName = config.providerName || 'OpenAI';
        this.maxTokens = config.maxTokens || 2048;
        this.ready = true;
        console.log(`✅ [${this.providerName}] Initialized with model: ${this.model}`);
    }

    async generateJSON(promptText) {
        if (!this.ready) {
            console.error(`❌ [${this.providerName}] Not initialized.`);
            return null;
        }
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Eres un asistente experto. Responde SIEMPRE con JSON puro, sin markdown, sin explicaciones adicionales.'
                        },
                        { role: 'user', content: promptText }
                    ],
                    temperature: 0.3,
                    max_tokens: this.maxTokens || 1024,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            return JSON.parse(text);

        } catch (error) {
            console.error(`❌ [${this.providerName}] Error:`, error.message);
            if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('quota')) {
                const quotaError = new Error(`⏳ Cuota de ${this.providerName} excedida. Intenta más tarde.`);
                quotaError.code = 'AI_QUOTA_EXCEEDED';
                throw quotaError;
            }
            return null;
        }
    }
}

module.exports = OpenAIProvider;
