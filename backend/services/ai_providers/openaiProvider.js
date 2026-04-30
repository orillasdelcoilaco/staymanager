/**
 * OpenAI-Compatible Provider Adapter
 * Funciona con OpenAI, Groq, SiliconFlow, Moonshot, OpenRouter, etc.
 * Usa fetch nativo (Node 18+).
 */

/**
 * Intenta obtener un objeto JSON desde texto que puede incluir markdown o texto alrededor.
 * @param {string} text
 * @returns {object|null}
 */
function parseAssistantJson(text) {
    if (!text || typeof text !== 'string') return null;
    let s = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        s = s.slice(first, last + 1);
    }
    try {
        return JSON.parse(s);
    } catch {
        try {
            return JSON.parse(text.trim());
        } catch {
            return null;
        }
    }
}

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

    /**
     * @param {string} promptText
     * @param {{ useJsonMode?: boolean }} [opts]
     */
    async _chatCompletion(promptText, opts = {}) {
        const useJsonMode = opts.useJsonMode !== false;
        const body = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content:
                        'Eres un asistente experto. Responde SIEMPRE con JSON válido (objeto), sin texto fuera del JSON.',
                },
                { role: 'user', content: promptText },
            ],
            temperature: 0.3,
            max_tokens: this.maxTokens || 2048,
        };
        if (useJsonMode) {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        const rawText = await response.text();
        if (!response.ok) {
            const err = new Error(`${this.providerName} API error ${response.status}: ${rawText.slice(0, 800)}`);
            err.status = response.status;
            err.bodySnippet = rawText;
            throw err;
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            throw new Error(`${this.providerName}: respuesta no JSON`);
        }

        const text = data.choices?.[0]?.message?.content || '';
        const parsed = parseAssistantJson(text);
        return { parsed, rawContent: text };
    }

    async generateJSON(promptText) {
        if (!this.ready) {
            console.error(`❌ [${this.providerName}] Not initialized.`);
            return null;
        }
        try {
            let attempt = await this._chatCompletion(promptText, { useJsonMode: true });
            if (!attempt.parsed && attempt.rawContent) {
                console.warn(`⚠️ [${this.providerName}] JSON mode devolvió contenido no parseable; reintento sin json_mode.`);
                attempt = await this._chatCompletion(promptText, { useJsonMode: false });
            }
            if (attempt.parsed && typeof attempt.parsed === 'object') {
                return attempt.parsed;
            }
            return null;
        } catch (error) {
            const msg = error.message || '';
            console.error(`❌ [${this.providerName}] Error:`, msg.slice(0, 500));

            if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota')) {
                const quotaError = new Error(`⏳ Cuota de ${this.providerName} excedida. Intenta más tarde.`);
                quotaError.code = 'AI_QUOTA_EXCEEDED';
                throw quotaError;
            }

            // Algunos proxies rechazan response_format (400): un intento sin json_object
            if (error.status === 400 && /response_format|json_object|parameter/i.test(msg)) {
                try {
                    const retry = await this._chatCompletion(promptText, { useJsonMode: false });
                    if (retry.parsed && typeof retry.parsed === 'object') {
                        console.log(`✅ [${this.providerName}] Parse OK tras reintento sin json_mode`);
                        return retry.parsed;
                    }
                } catch (e2) {
                    console.warn(`⚠️ [${this.providerName}] Reintento sin json_mode falló:`, e2.message);
                }
            }

            return null;
        }
    }
}

module.exports = OpenAIProvider;
