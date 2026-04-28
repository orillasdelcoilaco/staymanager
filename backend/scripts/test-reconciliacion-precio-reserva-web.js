/**
 * Regla de tolerancia alineada con `PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP` en `publicWebsiteService.js`.
 * node backend/scripts/test-reconciliacion-precio-reserva-web.js
 */
const assert = require('assert');

const PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP = 1;

function coinciden(precioCliente, precioServidor) {
    const c = Math.round(Number(precioCliente) || 0);
    const s = Math.round(Number(precioServidor) || 0);
    return Math.abs(c - s) <= PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP;
}

assert.strictEqual(PRECIO_WEB_RECONCILIACION_TOLERANCIA_CLP, 1);
assert.strictEqual(coinciden(100_000, 100_000), true);
assert.strictEqual(coinciden(100_000.4, 100_000), true);
assert.strictEqual(coinciden(100_000, 100_001), true);
assert.strictEqual(coinciden(100_000, 100_002), false);

function esperadoConCuponPorcentaje(totalLista, pct) {
    return Math.round(totalLista * (1 - Math.min(100, Math.max(0, pct)) / 100));
}
assert.strictEqual(esperadoConCuponPorcentaje(100_000, 10), 90_000);
assert.strictEqual(coinciden(esperadoConCuponPorcentaje(100_000, 15), 85_000), true);

function esperadoConCuponMontoFijo(totalLista, montoDesc) {
    return Math.max(0, Math.round(totalLista) - Math.max(0, Math.round(Number(montoDesc) || 0)));
}
assert.strictEqual(esperadoConCuponMontoFijo(100_000, 25_000), 75_000);
assert.strictEqual(esperadoConCuponMontoFijo(50_000, 60_000), 0);
assert.strictEqual(coinciden(esperadoConCuponMontoFijo(99_999, 10_000), 89_999), true);

/** Misma fórmula que `computeRecargoMenoresCamasCLP` en publicWebsiteService (menores/camas × noches). */
function recargoMenoresCamasCLP(rm, rc, menores, camas, noches) {
    return (Math.max(0, rm) * Math.max(0, menores) + Math.max(0, rc) * Math.max(0, camas)) * Math.max(0, noches);
}
assert.strictEqual(recargoMenoresCamasCLP(5000, 10000, 1, 0, 3), 15_000);
assert.strictEqual(recargoMenoresCamasCLP(0, 8000, 2, 1, 2), 16_000);
assert.strictEqual(esperadoConCuponPorcentaje(100_000 + recargoMenoresCamasCLP(5000, 0, 1, 0, 2), 10), 99_000);

console.log('test-reconciliacion-precio-reserva-web: OK');
