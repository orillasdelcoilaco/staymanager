/**
 * Anthropic (Claude) Provider Adapter
 * Usa fetch nativo (Node 18+). Sin dependencias adicionales.
 */
class AnthropicProvider {
    constructor(config) {
        if (!config.apiKey) {
            console.warn('⚠️ [AnthropicProvider] No API Key provided.');
            this.ready = false;
            return;
        }
        this.apiKey = config.apiKey;
        this.model = config.model || 'claude-3-5-sonnet-20241022';
        this.baseUrl = 'https://api.anthropic.com/v1/messages';
        this.ready = true;
        console.log(`✅ [AnthropicProvider] Initialized with model: ${this.model}`);
    }

    async generateJSON(promptText) {
        if (!this.ready) {
            console.error('❌ [AnthropicProvider] Not initialized.');
            return null;
        }
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 2048,
                    system: 'Eres un asistente experto. Responde SIEMPRE con JSON puro, sin markdown, sin explicaciones adicionales.',
                    messages: [
                        { role: 'user', content: promptText }
                    ]
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
            }

            const data = await response.json();
            const text = data.content?.[0]?.text || '';

            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }

            return JSON.parse(jsonStr);

        } catch (error) {
            console.error('❌ [AnthropicProvider] Error:', error.message);
            if (error.message.includes('429') || error.message.includes('overloaded')) {
                const quotaError = new Error('⏳ Cuota de Anthropic excedida. Intenta más tarde.');
                quotaError.code = 'AI_QUOTA_EXCEEDED';
                throw quotaError;
            }
            return null;
        }
    }
}

module.exports = AnthropicProvider;
