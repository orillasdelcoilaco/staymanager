const assert = require('assert');
const {
    normalizarCheckInIdentidadCheckoutWeb,
    aceptaCheckboxIdentidad,
    CHECKIN_IDENTIDAD_POLITICA_VERSION,
} = require('../services/reservaWebCheckinIdentidadService');

assert.strictEqual(normalizarCheckInIdentidadCheckoutWeb({}), null);
assert.strictEqual(normalizarCheckInIdentidadCheckoutWeb({ documentoTipo: 'rut' }), null);

const r1 = normalizarCheckInIdentidadCheckoutWeb({ rut: '12.345.678-9', documentoTipo: 'rut' });
assert.ok(r1);
assert.strictEqual(r1.documentoTipo, 'rut');
assert.strictEqual(r1.documentoNumero, '12345678-9');

const r2 = normalizarCheckInIdentidadCheckoutWeb({ documentoTipo: 'pasaporte', documentoNumero: ' AB 123456 ' });
assert.strictEqual(r2.documentoTipo, 'pasaporte');
assert.strictEqual(r2.documentoNumero, 'AB 123456');

const r3 = normalizarCheckInIdentidadCheckoutWeb({
    documentoTipo: 'dni_otro',
    documentoNumero: 'X-9',
    nacionalidadHuesped: 'cl',
    fechaNacimientoHuesped: '1990-05-15',
});
assert.strictEqual(r3.nacionalidad, 'CL');
assert.strictEqual(r3.fechaNacimiento, '1990-05-15');

const rFut = normalizarCheckInIdentidadCheckoutWeb({
    documentoTipo: 'pasaporte', documentoNumero: 'Z', fechaNacimientoHuesped: '2030-01-01',
});
assert.ok(rFut);
assert.strictEqual(rFut.fechaNacimiento, undefined);

assert.strictEqual(aceptaCheckboxIdentidad(undefined), false);
assert.strictEqual(aceptaCheckboxIdentidad('0'), false);
assert.strictEqual(aceptaCheckboxIdentidad('1'), true);
assert.strictEqual(aceptaCheckboxIdentidad(true), true);
assert.strictEqual(CHECKIN_IDENTIDAD_POLITICA_VERSION, 'checkin-identidad-v1');

console.log('test-reserva-web-checkin-identidad-normalize: OK');
