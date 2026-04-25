/**
 * Modo “GPT / cliente final”: respuestas JSON sin telemetría interna ni pistas SQL.
 * Activar en Render cuando el Action/MCP sea público: PUBLIC_AI_SANITIZE_RESPONSES=1
 * (también acepta PUBLIC_AI_PUBLIC_MODE=1). Por defecto desactivado para no romper QA.
 */

function isPublicAiSanitizeResponses() {
    const a = String(process.env.PUBLIC_AI_SANITIZE_RESPONSES || '').trim().toLowerCase();
    const b = String(process.env.PUBLIC_AI_PUBLIC_MODE || '').trim().toLowerCase();
    const on = (v) => v === '1' || v === 'true' || v === 'yes' || v === 'on';
    return on(a) || on(b);
}

const STRIP_KEYS = new Set([
    'payload_version',
    'reserva_guard_diag',
    'catalog_id_candidatos',
    'empresa_ids_probados',
    'debug',
    'details',
    'sugerencia_previa',
    'booking_workflow',
    'email_error',
    'email_admin_error',
    'companiesIds',
]);

function _stripKey(k) {
    if (STRIP_KEYS.has(k)) return true;
    if (k.startsWith('email_template_')) return true;
    if (k.startsWith('email_admin_template_')) return true;
    return false;
}

function sanitizePublicAiPayloadDeep(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((x) => sanitizePublicAiPayloadDeep(x));
    if (typeof value !== 'object') return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (_stripKey(k)) continue;
        if (k === 'ai_verification_mode') continue;
        out[k] = sanitizePublicAiPayloadDeep(v);
    }
    return out;
}

function maybeSanitizePublicAiResponse(obj) {
    if (!isPublicAiSanitizeResponses()) return obj;
    try {
        return sanitizePublicAiPayloadDeep(
            typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj))
        );
    } catch (_) {
        return { success: false, error: 'INTERNAL_ERROR' };
    }
}

function publicAiGenericInternalErrorBody() {
    return { success: false, error: 'INTERNAL_ERROR', message: 'No pudimos completar la operación. Intenta nuevamente más tarde.' };
}

module.exports = {
    isPublicAiSanitizeResponses,
    sanitizePublicAiPayloadDeep,
    maybeSanitizePublicAiResponse,
    publicAiGenericInternalErrorBody,
};
