/**
 * Verificación rápida de validateLegalPoliticaCancelacion (sin DB).
 * Ejecutar: node backend/scripts/test-legal-politica-cancelacion.js
 */
const assert = require('assert');
const { validateLegalPoliticaCancelacion } = require('../services/checkoutDesgloseService');

assert.deepStrictEqual(validateLegalPoliticaCancelacion(null), { ok: true });
assert.deepStrictEqual(validateLegalPoliticaCancelacion({ politicaCancelacionModo: 'texto_solo' }), { ok: true });
assert.deepStrictEqual(validateLegalPoliticaCancelacion({ politicaCancelacionModo: 'gratis_ilimitada' }), { ok: true });

const bad = validateLegalPoliticaCancelacion({
    politicaCancelacionModo: 'gratis_hasta_horas',
    politicaCancelacionHorasGratis: 0,
});
assert.strictEqual(bad.ok, false);
assert.ok(Array.isArray(bad.errors) && bad.errors.length >= 1);

const bad2 = validateLegalPoliticaCancelacion({
    politicaCancelacionModo: 'gratis_hasta_horas',
    politicaCancelacionHorasGratis: 9000,
});
assert.strictEqual(bad2.ok, false);

const ok = validateLegalPoliticaCancelacion({
    politicaCancelacionModo: 'gratis_hasta_horas',
    politicaCancelacionHorasGratis: 48.2,
});
assert.strictEqual(ok.ok, true);
assert.deepStrictEqual(ok.legalPatch, { politicaCancelacionHorasGratis: 48 });

console.log('validateLegalPoliticaCancelacion: OK');
