/**
 * Smoke automatizado §2 ítem 1 (parte booking): sanitize + rechazo min/max noches.
 */
const assert = require('assert');
const { sanitizeBookingSettingsIncoming, normalizeBookingUrlForSsr } = require('../services/bookingSettingsSanitize');

let failed = false;
function t(name, fn) {
    try {
        fn();
        console.log(`OK  ${name}`);
    } catch (e) {
        failed = true;
        console.error(`FAIL ${name}:`, e.message);
    }
}

t('vacío → ok y objeto', () => {
    const r = sanitizeBookingSettingsIncoming(null);
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.booking, {});
});

t('clamp minNoches', () => {
    const r = sanitizeBookingSettingsIncoming({ minNoches: 0 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.minNoches, 1);
});

t('rechaza max < min', () => {
    const r = sanitizeBookingSettingsIncoming({ minNoches: 5, maxNochesEstadia: 3 });
    assert.strictEqual(r.ok, false);
    assert.ok(Array.isArray(r.errors) && r.errors.length);
});

t('max 0 sin tope → ok', () => {
    const r = sanitizeBookingSettingsIncoming({ minNoches: 14, maxNochesEstadia: 0 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.minNoches, 14);
});

t('preserva clave desconocida', () => {
    const r = sanitizeBookingSettingsIncoming({ minNoches: 2, fooBar: 99 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.fooBar, 99);
});

t('URL http válida', () => {
    const r = sanitizeBookingSettingsIncoming({ checkinOnlineUrl: 'https://x.example/check' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.checkinOnlineUrl, 'https://x.example/check');
});

t('URL inválida → cadena vacía', () => {
    const r = sanitizeBookingSettingsIncoming({ manualHuespedUrl: 'not-a-url' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.manualHuespedUrl, '');
});

t('manualHuespedPdfUrl válida', () => {
    const r = sanitizeBookingSettingsIncoming({ manualHuespedPdfUrl: 'https://cdn.example.com/m.pdf' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.manualHuespedPdfUrl, 'https://cdn.example.com/m.pdf');
});

t('manualHuespedPdfUrl inválida → vacío', () => {
    const r = sanitizeBookingSettingsIncoming({ manualHuespedPdfUrl: 'ftp://bad' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.manualHuespedPdfUrl, '');
});

t('retención identidad: inactivo + días clamp', () => {
    const r = sanitizeBookingSettingsIncoming({
        checkinIdentidadRetencionAutomaticaActivo: false,
        checkinIdentidadRetencionDiasTrasCheckout: 45,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.checkinIdentidadRetencionAutomaticaActivo, false);
    assert.strictEqual(r.booking.checkinIdentidadRetencionDiasTrasCheckout, 45);
});

t('retención identidad: activo + días extremos', () => {
    const r = sanitizeBookingSettingsIncoming({
        checkinIdentidadRetencionAutomaticaActivo: true,
        checkinIdentidadRetencionDiasTrasCheckout: 900,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.checkinIdentidadRetencionAutomaticaActivo, true);
    assert.strictEqual(r.booking.checkinIdentidadRetencionDiasTrasCheckout, 730);
});

t('co-huéspedes identidad: boolean preservado', () => {
    const rOn = sanitizeBookingSettingsIncoming({ checkinIdentidadCoHuespedesActivo: true });
    assert.strictEqual(rOn.ok, true);
    assert.strictEqual(rOn.booking.checkinIdentidadCoHuespedesActivo, true);
    const rOff = sanitizeBookingSettingsIncoming({ checkinIdentidadCoHuespedesActivo: false });
    assert.strictEqual(rOff.ok, true);
    assert.strictEqual(rOff.booking.checkinIdentidadCoHuespedesActivo, false);
});

t('co-huéspedes identidad: no boolean → coerción', () => {
    const r = sanitizeBookingSettingsIncoming({ checkinIdentidadCoHuespedesActivo: 1 });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.booking.checkinIdentidadCoHuespedesActivo, true);
    const r0 = sanitizeBookingSettingsIncoming({ checkinIdentidadCoHuespedesActivo: 0 });
    assert.strictEqual(r0.ok, true);
    assert.strictEqual(r0.booking.checkinIdentidadCoHuespedesActivo, false);
});

t('hora estimada llegada checkout: boolean', () => {
    const rOn = sanitizeBookingSettingsIncoming({ checkinHoraEstimadaLlegadaActivo: true });
    assert.strictEqual(rOn.ok, true);
    assert.strictEqual(rOn.booking.checkinHoraEstimadaLlegadaActivo, true);
    const rOff = sanitizeBookingSettingsIncoming({ checkinHoraEstimadaLlegadaActivo: false });
    assert.strictEqual(rOff.ok, true);
    assert.strictEqual(rOff.booking.checkinHoraEstimadaLlegadaActivo, false);
});

t('normalizeBookingUrlForSsr (SSR / confirmación)', () => {
    assert.strictEqual(normalizeBookingUrlForSsr(''), '');
    assert.strictEqual(normalizeBookingUrlForSsr('https://cdn.example.com/m.pdf'), 'https://cdn.example.com/m.pdf');
    assert.strictEqual(normalizeBookingUrlForSsr('javascript:alert(1)'), '');
    assert.strictEqual(normalizeBookingUrlForSsr('ftp://bad'), '');
});

if (failed) process.exit(1);
console.log('\nTodas las pruebas bookingSettingsSanitize pasaron.');
