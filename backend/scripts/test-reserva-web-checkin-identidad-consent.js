/**
 * Reglas de consentimiento identidad checkout web (servidor, sin PG).
 * node backend/scripts/test-reserva-web-checkin-identidad-consent.js
 */
const assert = require('assert');
const {
    normalizarCheckInIdentidadCheckoutWeb,
    assertConsentIdentidadCheckinWeb,
    snapshotCheckInIdentidadAceptacion,
    CHECKIN_IDENTIDAD_POLITICA_VERSION,
} = require('../services/reservaWebCheckinIdentidadService');

const ciEjemplo = normalizarCheckInIdentidadCheckoutWeb({
    documentoTipo: 'rut',
    rut: '12.345.678-9',
});

assert.ok(ciEjemplo);

assertConsentIdentidadCheckinWeb(null, undefined, 'es');
assertConsentIdentidadCheckinWeb(null, false, 'es');
assertConsentIdentidadCheckinWeb(ciEjemplo, '1', 'es');
assertConsentIdentidadCheckinWeb(ciEjemplo, true, 'en');

assert.throws(
    () => assertConsentIdentidadCheckinWeb(ciEjemplo, undefined, 'es'),
    (e) => e.statusCode === 400 && /identidad/i.test(e.message),
);
assert.throws(
    () => assertConsentIdentidadCheckinWeb(ciEjemplo, '0', 'en'),
    (e) => e.statusCode === 400 && /consent/i.test(e.message),
);

const fixed = new Date('2026-04-24T15:00:00.000Z');
const snap = snapshotCheckInIdentidadAceptacion(fixed);
assert.strictEqual(snap.politicaVersion, CHECKIN_IDENTIDAD_POLITICA_VERSION);
assert.strictEqual(snap.aceptadoAt, fixed.toISOString());

console.log('test-reserva-web-checkin-identidad-consent: OK');
