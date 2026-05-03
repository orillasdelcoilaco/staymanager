/**
 * Contrato de acceso para /feed-google-hotels-content.xml
 */
const assert = require('assert');
const { validateGoogleHotelsContentFeedAccess } = require('../services/googleHotelsContentFeedRequest');

assert.deepStrictEqual(validateGoogleHotelsContentFeedAccess({}, ''), { ok: true });
assert.deepStrictEqual(validateGoogleHotelsContentFeedAccess({ token: 'abc' }, 'abc'), { ok: true });
{
    const r = validateGoogleHotelsContentFeedAccess({}, 'abc');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 401);
}
{
    const r = validateGoogleHotelsContentFeedAccess({ token: 'wrong' }, 'abc');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 401);
}
{
    const r = validateGoogleHotelsContentFeedAccess(
        {},
        'secret',
        { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)', verifierUaSubstrEnv: 'Googlebot' },
    );
    assert.strictEqual(r.ok, true);
}
{
    const r = validateGoogleHotelsContentFeedAccess(
        {},
        'secret',
        { userAgent: 'curl/8.0', verifierUaSubstrEnv: 'Googlebot' },
    );
    assert.strictEqual(r.ok, false);
}

console.log('test-google-hotels-content-feed-request: OK');
