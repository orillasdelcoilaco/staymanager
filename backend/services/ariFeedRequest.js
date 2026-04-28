function normalizeAriMode(rawMode) {
    const v = String(rawMode || '').trim().toLowerCase();
    return v === 'google_hotels' ? 'google_hotels' : 'website';
}

function normalizeAriDays(rawDays) {
    const n = Math.round(Number(rawDays));
    if (!Number.isFinite(n)) return 180;
    return Math.min(365, Math.max(14, n));
}

function validateAriFeedAccess(query, configuredToken) {
    const expected = String(configuredToken || '').trim();
    if (!expected) return { ok: true };
    const provided = String((query && query.token) || '').trim();
    if (provided && provided === expected) return { ok: true };
    return { ok: false, status: 401, error: 'Token inválido para feed ARI.' };
}

function normalizeAriFeedRequest(query, configuredToken) {
    const access = validateAriFeedAccess(query, configuredToken);
    if (!access.ok) return access;
    return {
        ok: true,
        mode: normalizeAriMode(query && query.mode),
        days: normalizeAriDays(query && query.days),
    };
}

module.exports = {
    normalizeAriMode,
    normalizeAriDays,
    validateAriFeedAccess,
    normalizeAriFeedRequest,
};

