/**
 * Factory de proveedores de IA (extraído de aiContentService para modularidad).
 */
const path = require('path');
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const aiConfig = require('../config/aiConfig');
const GeminiProvider = require('./ai_providers/geminiProvider');
const OpenAIProvider = require('./ai_providers/openaiProvider');
const AnthropicProvider = require('./ai_providers/anthropicProvider');
const DeepSeekProvider = require('./ai_providers/deepseekProvider');
const OllamaProvider = require('./ai_providers/ollamaProvider');

function getProvider(providerType) {
    const type = providerType || aiConfig.provider;

    switch (type) {
        case 'openai':
            return new OpenAIProvider(aiConfig.openai);
        case 'claude':
            return new AnthropicProvider(aiConfig.claude);
        case 'deepseek':
            return new DeepSeekProvider(aiConfig.deepseek);
        case 'siliconflow':
            return new OpenAIProvider(aiConfig.siliconflow);
        case 'moonshot':
            return new OpenAIProvider(aiConfig.moonshot);
        case 'groq':
            return new OpenAIProvider(aiConfig.groq);
        case 'openrouter':
            return new OpenAIProvider(aiConfig.openrouter);
        case 'ollama':
            return new OllamaProvider(aiConfig.ollama);
        case 'gemini':
        default:
            if (type !== 'gemini') {
                console.warn(`[AI Service] Unknown provider '${type}', falling back to Gemini.`);
            }
            return new GeminiProvider(aiConfig.gemini);
    }
}

module.exports = { getProvider };
