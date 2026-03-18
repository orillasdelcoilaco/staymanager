/**
 * DeepSeek Provider Adapter
 * API compatible con OpenAI. Usa fetch nativo (Node 18+).
 */
class DeepSeekProvider {
    constructor(config) {
        if (!config.apiKey) {
            console.warn('⚠️ [DeepSeekProvider] No API Key provided.');
            this.ready = false;
            return;
        }
        this.apiKey = config.apiKey;
        this.model = config.model || 'deepseek-chat';
        this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
        this.ready = true;
        console.log(`✅ [DeepSeekProvider] Initialized with model: ${this.model}`);
    }

    async generateJSON(promptText) {
        if (!this.ready) {
            console.error('❌ [DeepSeekProvider] Not initialized.');
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
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';

            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            return JSON.parse(jsonStr);

        } catch (error) {
            console.error('❌ [DeepSeekProvider] Error:', error.message);
            if (error.message.includes('429')) {
                const quotaError = new Error('⏳ Cuota de DeepSeek excedida. Intenta más tarde.');
                quotaError.code = 'AI_QUOTA_EXCEEDED';
                throw quotaError;
            }
            return null;
        }
    }
}

module.exports = DeepSeekProvider;
