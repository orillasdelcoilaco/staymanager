/**
 * Desglose de precio alineado a checkout (presupuesto / JSON presupuesto).
 * node backend/scripts/test-presupuesto-desglose.js
 */
const assert = require('assert');
const { buildDesglosePrecioCheckout } = require('../services/checkoutDesgloseService');

const legal = {
    desglosePrecioCheckout: {
        mostrar: true,
        modelo: 'cl_iva_incluido',
        tasaIvaPct: 19,
        lineasExtra: [
            { tipo: 'por_persona_noche', montoPorPersonaNocheCLP: 500, etiqueta: 'Tasa por persona' },
        ],
    },
};

const d = buildDesglosePrecioCheckout(119000, legal, 'es', { noches: 2, huespedes: 3 });
assert.strictEqual(d.mostrar, true);
assert.ok(Array.isArray(d.lineas));
assert.ok(d.lineas.length >= 3, 'neto + iva + extra');
const extra = d.lineas.find((l) => l.etiqueta === 'Tasa por persona');
assert.ok(extra, 'línea extra por etiqueta');
assert.strictEqual(extra.montoCLP, 500 * 2 * 3);

const sinIva = buildDesglosePrecioCheckout(
    50000,
    { desglosePrecioCheckout: { mostrar: true, modelo: 'sin_desglose', lineasExtra: [{ tipo: 'porcentaje_total', porcentaje: 10, etiqueta: 'Servicio' }] } },
    'es',
    { noches: 1, huespedes: 1 }
);
assert.strictEqual(sinIva.mostrar, true);
assert.ok(sinIva.lineas.some((l) => l.etiqueta === 'Servicio'));

console.log('test-presupuesto-desglose: OK');
