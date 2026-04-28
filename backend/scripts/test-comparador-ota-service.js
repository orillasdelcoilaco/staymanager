/**
 * Contrato mínimo de comparador OTA (totales por canal en rango).
 */
const assert = require('assert');
const { calcularComparadorOtaTotales } = require('../services/comparadorOtaService');

const mkDate = (s) => new Date(`${s}T00:00:00Z`);

const allTarifas = [
    {
        alojamientoId: 'cabana1',
        fechaInicio: mkDate('2026-05-01'),
        fechaTermino: mkDate('2026-05-31'),
        precios: { directo: 100000, ota: 120000 },
        metadata: {},
    },
];

const ok = calcularComparadorOtaTotales({
    allTarifas,
    propiedadId: 'cabana1',
    startDate: mkDate('2026-05-10'),
    endDate: mkDate('2026-05-13'),
    canalDirectoId: 'directo',
    canalComparadoId: 'ota',
});
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.nights, 3);
assert.strictEqual(ok.totalDirectoCLP, 300000);
assert.strictEqual(ok.totalComparadoCLP, 360000);
assert.strictEqual(ok.ahorroCLP, 60000);
assert.strictEqual(ok.nochesSinTarifaComparada, 0);

const missing = calcularComparadorOtaTotales({
    allTarifas: [{
        alojamientoId: 'cabana1',
        fechaInicio: mkDate('2026-05-01'),
        fechaTermino: mkDate('2026-05-31'),
        precios: { directo: 100000 },
        metadata: {},
    }],
    propiedadId: 'cabana1',
    startDate: mkDate('2026-05-10'),
    endDate: mkDate('2026-05-12'),
    canalDirectoId: 'directo',
    canalComparadoId: 'ota',
});
assert.strictEqual(missing.ok, true);
assert.strictEqual(missing.nochesSinTarifaComparada, 2);

console.log('test-comparador-ota-service: OK');
