/**
 * Contrato: saneamiento y expansión de mapa de calor por fecha.
 */
const assert = require('assert');
const {
    sanitizeHeatmapEventosDemanda,
    buildHeatmapForRange,
    minNochesLlegadaParaFecha,
} = require('../services/heatmapRestriccionesService');

const inRules = [
    { nombre: 'Feriado largo', desde: '2026-09-15', hasta: '2026-09-20', nivel: 5, minNochesLlegada: 3 },
    { nombre: 'Fiesta local', desde: '2026-09-18', hasta: '2026-09-19', nivel: 4, minNochesLlegada: 2 },
    { nombre: 'inválido', desde: 'x', hasta: '2026-09-20' },
];
const s = sanitizeHeatmapEventosDemanda(inRules);
assert.strictEqual(Array.isArray(s), true);
assert.strictEqual(s.length, 2);

const h = buildHeatmapForRange(
    { eventosDemandaMapaCalor: inRules },
    '2026-09-14',
    '2026-09-21',
);
assert.strictEqual(Array.isArray(h), true);
assert.strictEqual(h.length, 6);
const day18 = h.find((d) => d.fecha === '2026-09-18');
assert.ok(day18, 'debe incluir 2026-09-18');
assert.strictEqual(day18.nivel, 5);
assert.strictEqual(day18.minNochesLlegada, 3);
assert.ok(Array.isArray(day18.motivos) && day18.motivos.length >= 1);

assert.strictEqual(minNochesLlegadaParaFecha({ eventosDemandaMapaCalor: inRules }, '2026-09-18'), 3);
assert.strictEqual(minNochesLlegadaParaFecha({ eventosDemandaMapaCalor: inRules }, '2026-09-14'), 1);

console.log('test-heatmap-restricciones: OK');
