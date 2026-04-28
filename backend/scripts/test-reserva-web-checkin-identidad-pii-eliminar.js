/**
 * Eliminación PII identidad web en metadata (sin PG).
 * node backend/scripts/test-reserva-web-checkin-identidad-pii-eliminar.js
 */
const assert = require('assert');
const {
    tienePiiCheckInIdentidadEnMetadata,
    metadataTrasEliminarPiiCheckinIdentidad,
} = require('../services/reservaWebCheckinIdentidadService');

assert.strictEqual(tienePiiCheckInIdentidadEnMetadata(null), false);
assert.strictEqual(tienePiiCheckInIdentidadEnMetadata({}), false);
assert.strictEqual(tienePiiCheckInIdentidadEnMetadata({ reservaWebCheckout: {} }), false);
assert.strictEqual(tienePiiCheckInIdentidadEnMetadata({
    reservaWebCheckout: { checkInIdentidad: { documentoTipo: 'rut' } },
}), false);

const metaSoloLlegada = {
    origen: 'website',
    reservaWebCheckout: {
        horaLlegadaEstimada: '  15:00  ',
        comentariosHuesped: '',
    },
};
assert.strictEqual(tienePiiCheckInIdentidadEnMetadata(metaSoloLlegada), true);
const rLleg = metadataTrasEliminarPiiCheckinIdentidad(metaSoloLlegada, 'admin@test.com');
assert.strictEqual(rLleg.changed, true);
assert.strictEqual(rLleg.metadata.reservaWebCheckout.horaLlegadaEstimada, undefined);
assert.ok(rLleg.metadata.reservaWebCheckout.checkInIdentidadEliminacion);
assert.strictEqual(rLleg.metadata.edicionesManuales['reservaWebCheckout.horaLlegadaEstimada'], true);

const metaCon = {
    origen: 'website',
    edicionesManuales: {},
    reservaWebCheckout: {
        menores: 1,
        checkInIdentidad: { documentoTipo: 'rut', documentoNumero: '1-9' },
        checkInIdentidadAceptacion: { aceptadoAt: '2026-01-01T00:00:00.000Z', politicaVersion: 'v1' },
    },
};
assert.strictEqual(tienePiiCheckInIdentidadEnMetadata(metaCon), true);

const r1 = metadataTrasEliminarPiiCheckinIdentidad(metaCon, 'admin@test.com');
assert.strictEqual(r1.changed, true);
assert.strictEqual(r1.metadata.reservaWebCheckout.checkInIdentidad, undefined);
assert.strictEqual(r1.metadata.reservaWebCheckout.checkInIdentidadAceptacion, undefined);
assert.ok(r1.metadata.reservaWebCheckout.checkInIdentidadEliminacion);
assert.strictEqual(r1.metadata.reservaWebCheckout.checkInIdentidadEliminacion.eliminadoPorEmail, 'admin@test.com');
const metaConMotivo = JSON.parse(JSON.stringify(metaCon));
const rMot = metadataTrasEliminarPiiCheckinIdentidad(
    metaConMotivo,
    'job',
    { motivo: 'retencion_automatica_post_checkout', diasPoliticaRetencion: 30 },
);
assert.strictEqual(rMot.metadata.reservaWebCheckout.checkInIdentidadEliminacion.eliminadoMotivo, 'retencion_automatica_post_checkout');
assert.strictEqual(rMot.metadata.reservaWebCheckout.checkInIdentidadEliminacion.diasPoliticaRetencion, 30);
assert.strictEqual(r1.metadata.reservaWebCheckout.menores, 1);
assert.strictEqual(r1.metadata.edicionesManuales['reservaWebCheckout.checkInIdentidad'], true);

const r2 = metadataTrasEliminarPiiCheckinIdentidad(r1.metadata, 'otro@test.com');
assert.strictEqual(r2.changed, false);

console.log('test-reserva-web-checkin-identidad-pii-eliminar: OK');
