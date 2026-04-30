/**
 * Cadena de proveedores para tareas JSON (generateForTask).
 * Objetivo: al menos 6 backends distintos cuando las claves están en .env / Render.
 */
const aiConfig = require('../config/aiConfig');
const { TASK_PROVIDER_MAP } = require('./ai/aiEnums');

const PROVIDER_ENV_KEYS = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    siliconflow: 'SILICONFLOW_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openai: 'OPENAI_API_KEY',
    claude: 'CLAUDE_API_KEY',
};

/** Orden por defecto: 8 proveedores distintos (OpenAI-compatible + Gemini + Claude). */
const DEFAULT_CRITICAL_CHAIN = [
    'groq',
    'gemini',
    'openrouter',
    'siliconflow',
    'moonshot',
    'deepseek',
    'openai',
    'claude',
];

function orderedUnique(ids) {
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

/**
 * Comprueba si hay API key en env (sin instanciar el cliente).
 * @param {string} providerId
 * @returns {boolean}
 */
function hasProviderApiKey(providerId) {
    const envName = PROVIDER_ENV_KEYS[providerId];
    if (!envName) return false;
    const v = process.env[envName];
    return Boolean(v && String(v).trim());
}

function parseCriticalChainFromEnv() {
    const raw = process.env.AI_CRITICAL_PROVIDER_CHAIN || '';
    if (!raw.trim()) return [...DEFAULT_CRITICAL_CHAIN];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

let _loggedChain = false;

/**
 * Construye la lista ordenada de proveedores para una invocación JSON.
 * Incluye: preferido por tarea → cadena crítica (solo con clave) → fallbackProviders → provider → implicitFallbacks.
 *
 * @param {string} taskType — AI_TASK.*
 * @returns {string[]}
 */
function buildJsonTaskProviderChain(taskType) {
    const preferredProvider = TASK_PROVIDER_MAP[taskType] || aiConfig.provider;
    const critical = parseCriticalChainFromEnv().filter(hasProviderApiKey);
    const chain = orderedUnique([
        preferredProvider,
        ...critical.filter((p) => p !== preferredProvider),
        ...aiConfig.fallbackProviders,
        aiConfig.provider,
        ...aiConfig.implicitFallbackProviders,
    ]).filter(hasProviderApiKey);

    if (!_loggedChain && process.env.AI_LOG_PROVIDER_CHAIN !== '0') {
        _loggedChain = true;
        console.log(
            `[AI] Cadena JSON (${taskType}): ${chain.length} proveedor(es) con clave — [${chain.join(', ')}]`
        );
    }

    return chain;
}

module.exports = {
    buildJsonTaskProviderChain,
    hasProviderApiKey,
    DEFAULT_CRITICAL_CHAIN,
};
