/**
 * Normaliza tokens opcionales en `websiteSettings.integrations` (PUT home-settings).
 * Caracteres permitidos: URL-safe sin espacios (máx 256).
 */

const MAX_LEN = 256;
const TOKEN_RE = /^[A-Za-z0-9._~-]+$/;

function _sanitizeTokenField(raw) {
    const t = String(raw ?? '').trim();
    if (!t) return { ok: true, value: '' };
    if (t.length > MAX_LEN) {
        return { ok: false, error: 'Token demasiado largo (máximo 256 caracteres).' };
    }
    if (!TOKEN_RE.test(t)) {
        return {
            ok: false,
            error: 'Token inválido: use solo letras, números y los símbolos . _ - ~',
        };
    }
    return { ok: true, value: t };
}

/**
 * @param {object} incoming cuerpo `integrations` del cliente
 * @returns {{ ok: true, integrations: { ariFeedToken: string, googleHotelsContentToken: string } } | { ok: false, errors: string[] }}
 */
function sanitizeIntegrationsSettingsIncoming(incoming) {
    const errors = [];
    if (incoming == null || typeof incoming !== 'object') {
        return { ok: false, errors: ['integrations debe ser un objeto'] };
    }

    const a = _sanitizeTokenField(incoming.ariFeedToken);
    if (!a.ok) errors.push(a.error);
    const g = _sanitizeTokenField(incoming.googleHotelsContentToken);
    if (!g.ok) errors.push(g.error);

    if (errors.length) return { ok: false, errors };

    return {
        ok: true,
        integrations: {
            ariFeedToken: a.value || '',
            googleHotelsContentToken: g.value || '',
        },
    };
}

module.exports = { sanitizeIntegrationsSettingsIncoming };
