require('dotenv').config();

const aiConfig = {
    // Proveedor principal. Cambia con AI_PROVIDER en .env
    // Valores: 'gemini' | 'openai' | 'claude' | 'deepseek' | 'siliconflow' | 'moonshot'
    provider: process.env.AI_PROVIDER || 'gemini',

    // Cascade de fallback cuando el proveedor principal falla por cuota.
    // El sistema intentará cada proveedor de la lista en orden hasta que uno funcione.
    // Pon los gratuitos al final como respaldo. Ej: ['siliconflow', 'moonshot']
    fallbackProviders: (process.env.AI_FALLBACK_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean),

    // --- Proveedores configurados ---

    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo'
    },
    claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
    },
    deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    },

    // SiliconFlow: proxy gratuito con acceso a DeepSeek, Qwen, y otros modelos chinos.
    // Regístrate en https://siliconflow.cn/ para obtener una API key gratuita.
    siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY,
        model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3',
        baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        providerName: 'SiliconFlow'
    },

    // Moonshot Kimi: modelo chino con créditos gratuitos generosos.
    // Regístrate en https://platform.moonshot.cn/
    moonshot: {
        apiKey: process.env.MOONSHOT_API_KEY,
        model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
        baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
        providerName: 'Moonshot Kimi'
    },

    // Groq: inferencia ultrarrápida, tier gratuito generoso, sin tarjeta.
    // Regístrate en https://console.groq.com/
    // Modelos recomendados: llama-3.3-70b-versatile, llama3-8b-8192
    groq: {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        providerName: 'Groq'
    },

    // OpenRouter: proxy unificado con acceso a 200+ modelos, tier gratuito sin tarjeta.
    // Regístrate en https://openrouter.ai/
    // Modelos gratuitos recomendados: deepseek/deepseek-chat-v3-0324:free, meta-llama/llama-3.3-70b-instruct:free
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        providerName: 'OpenRouter',
        maxTokens: 4096
    }
};

module.exports = aiConfig;
