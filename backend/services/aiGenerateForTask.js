/**
 * Núcleo de invocación multi-proveedor para tareas JSON (texto/vision buffer en aiContentService).
 */
const aiConfig = require('../config/aiConfig');
const { AI_TASK, TASK_PROVIDER_MAP } = require('./ai/aiEnums');
const { getProvider } = require('./aiContentService.providers');
const { buildJsonTaskProviderChain } = require('./aiProviderChain');

function orderedUniqueProviders(ids) {
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
 * @param {string} taskType — AI_TASK.*
 * @param {string} prompt
 * @param {object} [opts]
 * @param {Buffer} [opts.imageBuffer] — solo IMAGE_METADATA
 * @param {number} [opts.maxProviders] — recorta la cadena (p. ej. plan fotos: evita timeout HTTP en Render)
 * @returns {Promise<object|null>}
 */
async function generateForTask(taskType, prompt, opts = {}) {
    if (taskType === AI_TASK.IMAGE_METADATA && opts.imageBuffer) {
        const gemini = getProvider('gemini');
        return gemini.generateJSON ? gemini.generateJSON(prompt, opts.imageBuffer) : null;
    }

    let providerChain = buildJsonTaskProviderChain(taskType);
    const cap = opts.maxProviders != null ? Number(opts.maxProviders) : NaN;
    if (Number.isFinite(cap) && cap > 0 && providerChain.length > cap) {
        providerChain = providerChain.slice(0, cap);
    }
    if (!providerChain.length) {
        console.error(
            `[AI Task:${taskType}] Ningún proveedor con API key configurada. Revisa GROQ/GEMINI/OPENROUTER/… en el entorno.`
        );
        return null;
    }

    const delayMs = Number(process.env.AI_CHAIN_DELAY_MS || 280);

    for (let i = 0; i < providerChain.length; i++) {
        const providerType = providerChain[i];
        if (i > 0 && delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
        }
        try {
            const provider = getProvider(providerType);
            const result = await provider.generateJSON(prompt);
            if (result) {
                // Comparación solo aquí (evita ReferenceError si un deploy quedó a medias con `preferredProvider` global)
                const taskPreferred = TASK_PROVIDER_MAP[taskType] || aiConfig.provider;
                if (providerType !== taskPreferred) {
                    console.log(`[AI Task:${taskType}] ✅ Fallback exitoso con: ${providerType}`);
                }
                return result;
            }
        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.warn(
                    `[AI Task:${taskType}] ⚠️ Cuota excedida en '${providerType}'. Intentando siguiente...`
                );
                continue;
            }
            if (error.code === 'AI_INJECTION_DETECTED') {
                throw error;
            }
            console.warn(`[AI Task:${taskType}] ⚠️ Error en '${providerType}': ${error.message}`);
            continue;
        }
    }

    console.error(`[AI Task:${taskType}] ❌ Todos los proveedores fallaron.`);
    return null;
}

async function generateWithFallback(prompt) {
    const providerChain = orderedUniqueProviders([
        aiConfig.provider,
        ...aiConfig.fallbackProviders,
        ...aiConfig.implicitFallbackProviders,
    ]);

    for (const providerType of providerChain) {
        try {
            const provider = getProvider(providerType);
            const result = await provider.generateJSON(prompt);
            if (result) {
                if (providerType !== aiConfig.provider) {
                    console.log(`[AI Cascade] ✅ Éxito con proveedor fallback: ${providerType}`);
                }
                return result;
            }
        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.warn(
                    `[AI Cascade] ⚠️ Cuota excedida en '${providerType}'. Intentando siguiente proveedor...`
                );
                continue;
            }
            throw error;
        }
    }

    console.error('[AI Cascade] ❌ Todos los proveedores fallaron o no tienen API key configurada.');
    return null;
}

module.exports = {
    generateForTask,
    generateWithFallback,
    orderedUniqueProviders,
};
