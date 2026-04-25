const assert = require('assert');

process.env.PUBLIC_AI_SANITIZE_RESPONSES = '1';
delete require.cache[require.resolve('../services/publicAiPublicModeSanitize')];
const {
    maybeSanitizePublicAiResponse,
    isPublicAiSanitizeResponses,
} = require('../services/publicAiPublicModeSanitize');

assert.strictEqual(isPublicAiSanitizeResponses(), true);

const cleaned = maybeSanitizePublicAiResponse({
    ok: true,
    payload_version: 'x',
    reserva_guard_diag: { sql: 'secret' },
    email_template_id: 'uuid',
    email_error: 'column x does not exist',
    data: { nested: { payload_version: 'y' } },
});
assert.strictEqual(cleaned.payload_version, undefined);
assert.strictEqual(cleaned.reserva_guard_diag, undefined);
assert.strictEqual(cleaned.email_template_id, undefined);
assert.strictEqual(cleaned.email_error, undefined);
assert.strictEqual(cleaned.data.nested.payload_version, undefined);

process.env.PUBLIC_AI_SANITIZE_RESPONSES = '0';
delete require.cache[require.resolve('../services/publicAiPublicModeSanitize')];
const mod2 = require('../services/publicAiPublicModeSanitize');
assert.strictEqual(mod2.isPublicAiSanitizeResponses(), false);
const raw = { a: 1, payload_version: 'keep' };
assert.strictEqual(mod2.maybeSanitizePublicAiResponse(raw), raw);

console.log('test-public-ai-sanitize: OK');
