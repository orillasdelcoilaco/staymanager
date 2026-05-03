/**
 * Acceso a GET /feed-google-hotels-content.xml (tenant).
 * §7.4: token opcional; bypass opcional para crawlers de verificación (User-Agent).
 */
function _parseVerifierUaSubstrs(raw) {
    return String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function _isVerifierUserAgent(userAgent, substrList) {
    const ua = String(userAgent || '').toLowerCase();
    if (!ua || !substrList.length) return false;
    return substrList.some((s) => ua.includes(String(s).toLowerCase()));
}

/**
 * @param {Record<string, unknown>} query
 * @param {string} configuredToken
 * @param {{ userAgent?: string, verifierUaSubstrEnv?: string }|undefined} [opts]
 */
function validateGoogleHotelsContentFeedAccess(query, configuredToken, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const expected = String(configuredToken || '').trim();
    if (!expected) return { ok: true };

    const provided = String((query && query.token) || '').trim();
    if (provided && provided === expected) return { ok: true };
    if (provided && provided !== expected) {
        return { ok: false, status: 401, error: 'Token inválido para feed de contenido Google Hotels.' };
    }

    const envStr =
        o.verifierUaSubstrEnv !== undefined && o.verifierUaSubstrEnv !== null
            ? String(o.verifierUaSubstrEnv)
            : String(process.env.GOOGLE_HOTELS_CONTENT_FEED_VERIFIER_UA_SUBSTR || '');
    const substrs = _parseVerifierUaSubstrs(envStr);
    if (substrs.length && _isVerifierUserAgent(o.userAgent, substrs)) {
        return { ok: true };
    }

    return { ok: false, status: 401, error: 'Token inválido para feed de contenido Google Hotels.' };
}

module.exports = {
    validateGoogleHotelsContentFeedAccess,
};
