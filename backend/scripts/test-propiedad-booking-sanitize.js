/**
 * Contrato: saneamiento de websiteData.booking a nivel alojamiento.
 */
const assert = require('assert');
const { sanitizePropertyWebsiteBookingIncoming } = require('../services/propiedadWebsiteBookingSanitize');

const a = sanitizePropertyWebsiteBookingIncoming({
    minNoches: '3',
    maxNochesEstadia: '10',
    minDiasAnticipacionReserva: '2',
    mesesReservableAdelante: '18',
    diasSemanaLlegadaPermitidos: [1, '5', 9, -1, 5],
});
assert.strictEqual(a.ok, true);
assert.deepStrictEqual(a.booking.diasSemanaLlegadaPermitidos, [1, 5]);
assert.strictEqual(a.booking.minNoches, 3);
assert.strictEqual(a.booking.maxNochesEstadia, 10);

const b = sanitizePropertyWebsiteBookingIncoming({
    minNoches: 5,
    maxNochesEstadia: 2,
});
assert.strictEqual(b.ok, false);
assert.ok((b.errors || []).length > 0, 'debe reportar error de coherencia min/max');

const c = sanitizePropertyWebsiteBookingIncoming({});
assert.strictEqual(c.ok, true);
assert.deepStrictEqual(c.booking, {});

console.log('test-propiedad-booking-sanitize: OK');
