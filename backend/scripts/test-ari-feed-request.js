/**
 * Contrato de parámetros y acceso para /feed-ari.xml
 */
const assert = require('assert');
const {
    normalizeAriMode,
    normalizeAriDays,
    validateAriFeedAccess,
    normalizeAriFeedRequest,
} = require('../services/ariFeedRequest');

assert.strictEqual(normalizeAriMode('google_hotels'), 'google_hotels');
assert.strictEqual(normalizeAriMode('GOOGLE_HOTELS'), 'google_hotels');
assert.strictEqual(normalizeAriMode('x'), 'website');

assert.strictEqual(normalizeAriDays(undefined), 180);
assert.strictEqual(normalizeAriDays(1), 14);
assert.strictEqual(normalizeAriDays(999), 365);
assert.strictEqual(normalizeAriDays(90), 90);

assert.deepStrictEqual(validateAriFeedAccess({}, ''), { ok: true });
assert.deepStrictEqual(validateAriFeedAccess({ token: 'abc' }, 'abc'), { ok: true });
{
    const r = validateAriFeedAccess({}, 'abc');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 401);
}

{
    const r = normalizeAriFeedRequest({ mode: 'google_hotels', days: 30, token: 't1' }, 't1');
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.mode, 'google_hotels');
    assert.strictEqual(r.days, 30);
}

console.log('test-ari-feed-request: OK');

