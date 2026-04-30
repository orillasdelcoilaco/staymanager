try {
    require('dotenv').config();
} catch {
    /* Ejecución desde scripts/ sin dotenv en raíz: process.env ya cargado por el caller */
}

/** Claves API: trim + BOM; evita 401 al pegar en Render con espacio o salto de línea final. */
function envApiKey(name) {
    const v = process.env[name];
    if (v == null) return undefined;
    let s = String(v).trim().replace(/^\uFEFF/, '');
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s || undefined;
}

const aiConfig = {
    // Proveedor principal. Cambia con AI_PROVIDER en .env
    // Valores: 'gemini' | 'openai' | 'claude' | 'deepseek' | 'siliconflow' | 'moonshot'
    provider: process.env.AI_PROVIDER || 'gemini',

    // Cascade de fallback cuando el proveedor principal falla por cuota.
    // El sistema intentará cada proveedor de la lista en orden hasta que uno funcione.
    // Pon los gratuitos al final como respaldo. Ej: ['siliconflow', 'moonshot']
    fallbackProviders: (process.env.AI_FALLBACK_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean),

    /**
     * Se añaden al final de la cadena de cada tarea si aún no están (orden preservado).
     * Evita el caso [groq] único cuando AI_PROVIDER=groq y la tarea ya prefiere groq (dedup eliminaba el segundo).
     * Desactivar: AI_IMPLICIT_FALLBACKS=0 o AI_IMPLICIT_FALLBACKS=false
     */
    implicitFallbackProviders:
        process.env.AI_IMPLICIT_FALLBACKS === '0' || process.env.AI_IMPLICIT_FALLBACKS === 'false'
            ? []
            : (process.env.AI_IMPLICIT_FALLBACKS || 'gemini')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),

    // --- Proveedores configurados ---

    gemini: {
        apiKey: envApiKey('GEMINI_API_KEY'),
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    },
    openai: {
        apiKey: envApiKey('OPENAI_API_KEY'),
        // gpt-4-turbo ya no está disponible para muchas cuentas nuevas; override con OPENAI_MODEL si hace falta
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    claude: {
        apiKey: envApiKey('CLAUDE_API_KEY'),
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
    },
    deepseek: {
        apiKey: envApiKey('DEEPSEEK_API_KEY'),
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    },

    // SiliconFlow: proxy gratuito con acceso a DeepSeek, Qwen, y otros modelos chinos.
    // Regístrate en https://siliconflow.cn/ para obtener una API key gratuita.
    siliconflow: {
        apiKey: envApiKey('SILICONFLOW_API_KEY'),
        model: process.env.SILICONFLOW_MODEL || 'deepseek-ai/DeepSeek-V3',
        baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
        providerName: 'SiliconFlow'
    },

    // Moonshot Kimi: modelo chino con créditos gratuitos generosos.
    // Regístrate en https://platform.moonshot.cn/
    moonshot: {
        apiKey: envApiKey('MOONSHOT_API_KEY'),
        model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k',
        baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
        providerName: 'Moonshot Kimi'
    },

    // Groq: inferencia ultrarrápida, tier gratuito generoso, sin tarjeta.
    // Regístrate en https://console.groq.com/
    // Modelos recomendados: llama-3.3-70b-versatile, llama3-8b-8192
    groq: {
        apiKey: envApiKey('GROQ_API_KEY'),
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        providerName: 'Groq',
        // Plan de fotos por espacio puede superar 4k de salida JSON; truncar rompe parseJSON → fallback por reglas.
        maxTokens: Number(process.env.GROQ_MAX_TOKENS || 8192),
    },

    // OpenRouter: proxy unificado con acceso a 200+ modelos, tier gratuito sin tarjeta.
    // Regístrate en https://openrouter.ai/
    // Slug :free vigente (el deepseek …-0324:free dejó de exponerse → 404).
    openrouter: {
        apiKey: envApiKey('OPENROUTER_API_KEY'),
        // Por defecto Llama 3.2 3B :free (liviano); override OPENROUTER_MODEL (ej. meta-llama/llama-3.3-70b-instruct:free)
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        providerName: 'OpenRouter',
        maxTokens: 4096
    },

    // Ollama: inferencia local, SOLO para desarrollo. NO usar en producción (Render).
    // Instalar: https://ollama.com/ | Descargar modelo: `ollama pull gemma3:4b`
    // Modelos recomendados: gemma3:4b (rápido), gemma3:12b (calidad), llama3.2:3b (liviano)
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'gemma3:4b',
        providerName: 'Ollama (Local Dev)'
    }
};

module.exports = aiConfig;
