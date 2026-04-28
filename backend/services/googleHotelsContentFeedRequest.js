function validateGoogleHotelsContentFeedAccess(query, configuredToken) {
    const expected = String(configuredToken || '').trim();
    if (!expected) return { ok: true };
    const provided = String((query && query.token) || '').trim();
    if (provided && provided === expected) return { ok: true };
    return { ok: false, status: 401, error: 'Token inválido para feed de contenido Google Hotels.' };
}

module.exports = {
    validateGoogleHotelsContentFeedAccess,
};
