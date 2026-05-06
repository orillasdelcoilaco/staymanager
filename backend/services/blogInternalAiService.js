/**
 * IA dedicada al borrador interno del blog (panel).
 * No usa GROQ_API_KEY, GEMINI_API_KEY ni la cadena global de `generateForTask`.
 *
 * Variables (backend `.env`):
 * - BLOG_INTERNAL_AI_PROVIDER — groq | gemini | openai | openrouter (default: groq)
 * - Según proveedor (solo una familia activa):
 *   - groq: BLOG_INTERNAL_GROQ_API_KEY, opcional BLOG_INTERNAL_GROQ_MODEL, BLOG_INTERNAL_GROQ_MAX_TOKENS
 *   - gemini: BLOG_INTERNAL_GEMINI_API_KEY, opcional BLOG_INTERNAL_GEMINI_MODEL
 *   - openai: BLOG_INTERNAL_OPENAI_API_KEY, opcional BLOG_INTERNAL_OPENAI_MODEL, BLOG_INTERNAL_OPENAI_BASE_URL, BLOG_INTERNAL_OPENAI_MAX_TOKENS
 *   - openrouter: BLOG_INTERNAL_OPENROUTER_API_KEY, opcional BLOG_INTERNAL_OPENROUTER_MODEL, BLOG_INTERNAL_OPENROUTER_MAX_TOKENS
 */
const path = require('path');
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const GeminiProvider = require('./ai_providers/geminiProvider');
const OpenAIProvider = require('./ai_providers/openaiProvider');

function envApiKey(name) {
    const v = process.env[name];
    if (v == null) return undefined;
    let s = String(v).trim().replace(/^\uFEFF/, '');
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    return s || undefined;
}

function getBlogInternalProvider() {
    const provider = (process.env.BLOG_INTERNAL_AI_PROVIDER || 'groq').trim().toLowerCase();

    if (provider === 'gemini') {
        const apiKey = envApiKey('BLOG_INTERNAL_GEMINI_API_KEY');
        if (!apiKey) {
            return { error: 'Configura BLOG_INTERNAL_GEMINI_API_KEY para la IA interna del blog.' };
        }
        const inst = new GeminiProvider({
            apiKey,
            model: process.env.BLOG_INTERNAL_GEMINI_MODEL || 'gemini-2.0-flash',
        });
        if (!inst.model) {
            return { error: 'No se pudo inicializar Gemini para el blog interno.' };
        }
        return { provider: inst };
    }

    if (provider === 'groq') {
        const apiKey = envApiKey('BLOG_INTERNAL_GROQ_API_KEY');
        if (!apiKey) {
            return { error: 'Configura BLOG_INTERNAL_GROQ_API_KEY para la IA interna del blog.' };
        }
        const inst = new OpenAIProvider({
            apiKey,
            model: process.env.BLOG_INTERNAL_GROQ_MODEL || 'llama-3.3-70b-versatile',
            baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
            providerName: 'Groq (blog interno)',
            maxTokens: Number(process.env.BLOG_INTERNAL_GROQ_MAX_TOKENS || 8192),
        });
        if (!inst.ready) {
            return { error: 'Proveedor blog interno (Groq) no inicializado: revisa la clave.' };
        }
        return { provider: inst };
    }

    if (provider === 'openai') {
        const apiKey = envApiKey('BLOG_INTERNAL_OPENAI_API_KEY');
        if (!apiKey) {
            return { error: 'Configura BLOG_INTERNAL_OPENAI_API_KEY para la IA interna del blog.' };
        }
        const inst = new OpenAIProvider({
            apiKey,
            model: process.env.BLOG_INTERNAL_OPENAI_MODEL || 'gpt-4o-mini',
            baseUrl: process.env.BLOG_INTERNAL_OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
            providerName: 'OpenAI (blog interno)',
            maxTokens: Number(process.env.BLOG_INTERNAL_OPENAI_MAX_TOKENS || 4096),
        });
        if (!inst.ready) {
            return { error: 'Proveedor blog interno (OpenAI) no inicializado: revisa la clave.' };
        }
        return { provider: inst };
    }

    if (provider === 'openrouter') {
        const apiKey = envApiKey('BLOG_INTERNAL_OPENROUTER_API_KEY');
        if (!apiKey) {
            return { error: 'Configura BLOG_INTERNAL_OPENROUTER_API_KEY para la IA interna del blog.' };
        }
        const inst = new OpenAIProvider({
            apiKey,
            model: process.env.BLOG_INTERNAL_OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free',
            baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
            providerName: 'OpenRouter (blog interno)',
            maxTokens: Number(process.env.BLOG_INTERNAL_OPENROUTER_MAX_TOKENS || 4096),
        });
        if (!inst.ready) {
            return { error: 'Proveedor blog interno (OpenRouter) no inicializado: revisa la clave.' };
        }
        return { provider: inst };
    }

    return {
        error: `BLOG_INTERNAL_AI_PROVIDER="${provider}" no soportado. Usa: groq, gemini, openai, openrouter.`,
    };
}

/**
 * @param {string} prompt
 * @returns {Promise<object>}
 */
async function generateBlogInternalDraftJson(prompt) {
    const resolved = getBlogInternalProvider();
    if (resolved.error) {
        const e = new Error(resolved.error);
        e.statusCode = 503;
        throw e;
    }
    try {
        const raw = await resolved.provider.generateJSON(prompt);
        if (!raw || typeof raw !== 'object') {
            const e = new Error('La IA interna del blog no devolvió JSON válido.');
            e.statusCode = 503;
            throw e;
        }
        return raw;
    } catch (err) {
        if (err.statusCode) throw err;
        if (err.code === 'AI_QUOTA_EXCEEDED') {
            err.statusCode = 429;
            throw err;
        }
        const e = new Error(err.message || 'Error al llamar a la IA interna del blog.');
        e.statusCode = 503;
        throw e;
    }
}

module.exports = {
    getBlogInternalProvider,
    generateBlogInternalDraftJson,
};
