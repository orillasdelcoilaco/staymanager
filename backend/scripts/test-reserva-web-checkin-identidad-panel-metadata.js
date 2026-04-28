/**
 * Edición identidad check-in desde panel (metadata pura, sin PG).
 * node backend/scripts/test-reserva-web-checkin-identidad-panel-metadata.js
 */
const assert = require('assert');
const {
    metadataTrasActualizarCheckinIdentidadPanel,
    normalizarCheckInIdentidadCheckoutWeb,
} = require('../services/reservaWebCheckinIdentidadService');

const base = {
    origen: 'website',
    reservaWebCheckout: {
        menores: 1,
        checkInIdentidad: { documentoTipo: 'rut', documentoNumero: '11111111-1' },
        checkInIdentidadAceptacion: { aceptadoAt: '2026-01-01T00:00:00.000Z', politicaVersion: 'checkin-identidad-v1' },
    },
};

const out = metadataTrasActualizarCheckinIdentidadPanel(
    base,
    { documentoTipo: 'pasaporte', documentoNumero: 'ZZ999888' },
    'staff@empresa.cl',
);
assert.strictEqual(out.metadata.reservaWebCheckout.menores, 1);
assert.strictEqual(out.metadata.reservaWebCheckout.checkInIdentidad.documentoTipo, 'pasaporte');
assert.strictEqual(out.metadata.reservaWebCheckout.checkInIdentidad.documentoNumero, 'ZZ999888');
assert.ok(out.metadata.reservaWebCheckout.checkInIdentidadAceptacion.aceptadoAt);
assert.ok(out.metadata.reservaWebCheckout.checkInIdentidadUltimaEdicionPanel.editadoAt);
assert.strictEqual(out.metadata.reservaWebCheckout.checkInIdentidadUltimaEdicionPanel.editadoPorEmail, 'staff@empresa.cl');

const conElim = {
    ...base,
    reservaWebCheckout: {
        ...base.reservaWebCheckout,
        checkInIdentidadEliminacion: { eliminadoAt: '2026-02-01T00:00:00.000Z', eliminadoPorEmail: 'a@b.c' },
    },
};
delete conElim.reservaWebCheckout.checkInIdentidad;
const out2 = metadataTrasActualizarCheckinIdentidadPanel(
    conElim,
    { documentoTipo: 'rut', rut: '12.345.678-9' },
    'x@y.z',
);
assert.strictEqual(out2.metadata.reservaWebCheckout.checkInIdentidadEliminacion, undefined);
assert.strictEqual(normalizarCheckInIdentidadCheckoutWeb({ documentoTipo: 'rut', rut: '12.345.678-9' }).documentoNumero, '12345678-9');

assert.throws(
    () => metadataTrasActualizarCheckinIdentidadPanel(base, { documentoTipo: 'rut' }, 'u@u.u'),
    (e) => e.statusCode === 400,
);

console.log('test-reserva-web-checkin-identidad-panel-metadata: OK');
