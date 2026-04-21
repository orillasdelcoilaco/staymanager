/**
 * sanitizer.js — Sanitización de inputs de IA y protección contra prompt injection
 *
 * Centraliza la limpieza de inputs del usuario antes de insertarlos en prompts.
 * Detecta y bloquea patrones comunes de prompt injection, limita longitudes,
 * y registra intentos sospechosos con el contexto del tenant para auditoría.
 */

const { TASK_INPUT_LIMITS } = require('../aiEnums');

/**
 * Patrones de prompt injection conocidos.
 * Cubren las técnicas más comunes documentadas a 2026.
 */
const INJECTION_PATTERNS = [
    // Instrucciones de override
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
    /override\s+(all\s+)?instructions?/i,

    // Role/system injection
    /\bsystem\s*:/i,
    /\buser\s*:/i,
    /\bassistant\s*:/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /<\|system\|>/i,
    /<\|user\|>/i,
    /<\|assistant\|>/i,

    // Jailbreak clásicos
    /\bjailbreak\b/i,
    /\bDAN\b/,
    /do\s+anything\s+now/i,
    /you\s+are\s+now\s+(a\s+)?(?:free|unrestricted)/i,
    /act\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?:a\s+)?(?:different|evil|uncensored)/i,

    // Exfiltración de contexto
    /repeat\s+(all|everything|the\s+above)\s+(back|verbatim)/i,
    /print\s+(all\s+)?(?:previous|your)\s+(instructions?|prompt|system)/i,
    /what\s+(are|were)\s+your\s+(original\s+)?instructions?/i,
    /reveal\s+your\s+(system\s+)?prompt/i,

    // Inyección de instrucciones anidadas
    /\}\s*\n\s*(?:ahora|now|then)\s+(?:ignore|forget)/i,
    /---+\s*(?:new\s+)?(?:instructions?|task)/i,
];

/**
 * Detecta si un string contiene patrones de prompt injection.
 * @param {string} input
 * @returns {{ safe: boolean, pattern: string|null }}
 */
function detectInjection(input) {
    if (typeof input !== 'string') return { safe: true, pattern: null };

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            return { safe: false, pattern: pattern.toString() };
        }
    }
    return { safe: true, pattern: null };
}

/**
 * Sanitiza un valor de input para uso en prompts de IA.
 *
 * @param {string} value — Texto del usuario a insertar en el prompt
 * @param {string} taskType — Tipo de tarea (AI_TASK.*) para aplicar límite correcto
 * @param {object} auditCtx — Contexto de auditoría { empresaId, campo }
 * @returns {string} — Texto sanitizado, listo para insertar en el prompt
 * @throws {Error} — Si se detecta intento de injection (code: 'AI_INJECTION_DETECTED')
 */
function sanitizeInput(value, taskType, auditCtx = {}) {
    if (value === null || value === undefined) return '';
    const str = String(value);

    // 1. Límite de longitud por tarea
    const limit = TASK_INPUT_LIMITS[taskType] || 1000;
    const truncated = str.length > limit ? str.slice(0, limit) + '...[truncado]' : str;

    // 2. Detección de injection
    const { safe, pattern } = detectInjection(truncated);
    if (!safe) {
        const logMsg = `[AI_SECURITY] Prompt injection detectado | empresa=${auditCtx.empresaId || 'N/A'} | tarea=${taskType} | campo=${auditCtx.campo || 'N/A'} | patron=${pattern}`;
        console.error(logMsg);

        const error = new Error('Input rechazado: contiene instrucciones no permitidas.');
        error.code = 'AI_INJECTION_DETECTED';
        error.auditCtx = auditCtx;
        throw error;
    }

    // 3. Limpieza básica: eliminar caracteres de control (excepto saltos de línea/tab)
    const cleaned = truncated.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return cleaned;
}

/**
 * Sanitiza múltiples campos de un objeto payload de una sola vez.
 *
 * @param {object} payload — Objeto con campos del usuario
 * @param {string[]} fields — Campos a sanitizar
 * @param {string} taskType — AI_TASK.*
 * @param {object} auditCtx — { empresaId }
 * @returns {object} — Copia del payload con los campos sanitizados
 */
function sanitizePayload(payload, fields, taskType, auditCtx = {}) {
    const result = { ...payload };
    for (const field of fields) {
        if (result[field] !== undefined) {
            result[field] = sanitizeInput(result[field], taskType, { ...auditCtx, campo: field });
        }
    }
    return result;
}

module.exports = { sanitizeInput, sanitizePayload, detectInjection };
