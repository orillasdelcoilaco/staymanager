/**
 * Contrato: ORDER BY permitido para marketplace (evita sort arbitrario).
 */
const assert = require('assert');
const { buildMarketplaceOrderBy } = require('../services/marketplaceService');

const byValor = buildMarketplaceOrderBy('valor');
assert.ok(byValor.startsWith('precio_desde ASC'));

const byValorDesc = buildMarketplaceOrderBy('valor_desc');
assert.ok(byValorDesc.startsWith('precio_desde DESC'));

const byRating = buildMarketplaceOrderBy('rating');
assert.ok(byRating.startsWith('rating DESC'));

const fallback = buildMarketplaceOrderBy('cualquier-cosa');
assert.strictEqual(fallback, 'rating DESC NULLS LAST, num_resenas DESC, p.nombre');

console.log('test-marketplace-sort: OK');
