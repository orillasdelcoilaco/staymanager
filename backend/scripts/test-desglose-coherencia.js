/**
 * validateDesglosePrecioCheckoutCoherencia (panel / PUT home-settings).
 * node backend/scripts/test-desglose-coherencia.js
 */
const assert = require('assert');
const {
    validateDesglosePrecioCheckoutCoherencia,
} = require('../services/checkoutDesgloseService');

assert.deepStrictEqual(validateDesglosePrecioCheckoutCoherencia(null), { ok: true });
assert.deepStrictEqual(validateDesglosePrecioCheckoutCoherencia({}), { ok: true });
assert.deepStrictEqual(
    validateDesglosePrecioCheckoutCoherencia({ desglosePrecioCheckout: { mostrar: false } }),
    { ok: true },
);

const badPct = validateDesglosePrecioCheckoutCoherencia({
    desglosePrecioCheckout: {
        mostrar: true,
        modelo: 'sin_desglose',
        lineasExtra: [
            { tipo: 'porcentaje_total', porcentaje: 60, etiqueta: 'A' },
            { tipo: 'porcentaje_total', porcentaje: 50, etiqueta: 'B' },
        ],
    },
});
assert.strictEqual(badPct.ok, false);
assert.ok(badPct.errors.some((e) => e.includes('% sobre total')));

const badNeto = validateDesglosePrecioCheckoutCoherencia({
    desglosePrecioCheckout: {
        mostrar: true,
        modelo: 'cl_iva_incluido',
        lineasExtra: [
            { tipo: 'porcentaje_neto', porcentaje: 70, etiqueta: 'A' },
            { tipo: 'porcentaje_neto', porcentaje: 40, etiqueta: 'B' },
        ],
    },
});
assert.strictEqual(badNeto.ok, false);
assert.ok(badNeto.errors.some((e) => e.includes('% sobre neto')));

const badSum = validateDesglosePrecioCheckoutCoherencia({
    desglosePrecioCheckout: {
        mostrar: true,
        modelo: 'sin_desglose',
        lineasExtra: [{ tipo: 'monto_fijo', montoCLP: 2_000_000, etiqueta: 'Cargo' }],
    },
});
assert.strictEqual(badSum.ok, false);
assert.ok(badSum.errors.some((e) => e.includes('supera ese total')));

const ok = validateDesglosePrecioCheckoutCoherencia({
    desglosePrecioCheckout: {
        mostrar: true,
        modelo: 'cl_iva_incluido',
        tasaIvaPct: 19,
        lineasExtra: [
            { tipo: 'porcentaje_total', porcentaje: 5, etiqueta: 'Servicio' },
            { tipo: 'por_noche', montoPorNocheCLP: 1000, etiqueta: 'Limpieza' },
        ],
    },
});
assert.deepStrictEqual(ok, { ok: true });

console.log('test-desglose-coherencia: OK');
