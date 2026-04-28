/**
 * Verificación de validateLineasExtraArray (panel / home-settings).
 * node backend/scripts/test-lineas-extra-validation.js
 */
const assert = require('assert');
const { validateLineasExtraArray } = require('../services/lineasExtraValidation');
const { calcularMontoLineaExtra } = require('../services/checkoutDesgloseService');

assert.deepStrictEqual(validateLineasExtraArray(undefined), { ok: true, lineasExtra: [] });
assert.deepStrictEqual(validateLineasExtraArray(null), { ok: true, lineasExtra: [] });
assert.deepStrictEqual(validateLineasExtraArray([]), { ok: true, lineasExtra: [] });

const bad = validateLineasExtraArray({});
assert.strictEqual(bad.ok, false);

const okPct = validateLineasExtraArray([
    { tipo: 'porcentaje_total', porcentaje: 1.5, etiqueta: 'Tasa' },
]);
assert.strictEqual(okPct.ok, true);
assert.strictEqual(okPct.lineasExtra[0].porcentaje, 1.5);

const okMonto = validateLineasExtraArray([
    { tipo: 'monto_fijo', montoCLP: 5000, etiquetaEn: 'Fee' },
]);
assert.strictEqual(okMonto.ok, true);

const okNoche = validateLineasExtraArray([
    { tipo: 'por_noche', montoPorNocheCLP: 3000, etiqueta: 'Limpieza' },
]);
assert.strictEqual(okNoche.ok, true);

const badRow = validateLineasExtraArray([
    { tipo: 'porcentaje_total', porcentaje: 0, etiqueta: 'X' },
]);
assert.strictEqual(badRow.ok, false);

const okPp = validateLineasExtraArray([
    { tipo: 'por_persona_noche', montoPorPersonaNocheCLP: 2000, etiqueta: 'Tasa por persona' },
]);
assert.strictEqual(okPp.ok, true);
assert.strictEqual(okPp.lineasExtra[0].montoPorPersonaNocheCLP, 2000);

const defPp = okPp.lineasExtra[0];
assert.strictEqual(calcularMontoLineaExtra(defPp, 100000, 80000, 3, 2), 12000);
assert.strictEqual(calcularMontoLineaExtra(defPp, 100000, 80000, 0, 2), 0);

console.log('validateLineasExtraArray: OK');
