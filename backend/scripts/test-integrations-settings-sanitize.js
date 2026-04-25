/**
 * Contrato sanitize `websiteSettings.integrations` (PUT home-settings).
 * node backend/scripts/test-integrations-settings-sanitize.js
 */
const assert = require('assert');
const { sanitizeIntegrationsSettingsIncoming } = require('../services/integrationsSettingsSanitize');

assert.deepStrictEqual(
    sanitizeIntegrationsSettingsIncoming({}),
    { ok: true, integrations: { ariFeedToken: '', googleHotelsContentToken: '' } },
);
assert.strictEqual(sanitizeIntegrationsSettingsIncoming({ ariFeedToken: 'x y' }).ok, false);

const ok = sanitizeIntegrationsSettingsIncoming({
    ariFeedToken: 't1_a',
    googleHotelsContentToken: 'gh~9',
});
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.integrations.ariFeedToken, 't1_a');
assert.strictEqual(ok.integrations.googleHotelsContentToken, 'gh~9');

console.log('test-integrations-settings-sanitize: OK');
