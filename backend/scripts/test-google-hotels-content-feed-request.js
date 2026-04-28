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

console.log('test-google-hotels-content-feed-request: OK');
