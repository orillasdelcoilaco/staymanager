/**
 * Contrato: normalización de subdominio usada en empresaService.
 */
const assert = require('assert');
const { normalizeSubdomain } = require('../services/empresaService');

assert.strictEqual(normalizeSubdomain('Orillas del Coilaco'), 'orillas-del-coilaco');
assert.strictEqual(normalizeSubdomain('  Ñandú + Spa!!  '), 'nandu-spa');
assert.strictEqual(normalizeSubdomain('___'), '');
assert.strictEqual(normalizeSubdomain('a'.repeat(90)).length, 63);

console.log('test-normalize-subdomain: OK');

