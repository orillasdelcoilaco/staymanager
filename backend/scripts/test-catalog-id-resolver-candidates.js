const assert = require('assert');
const { expandCatalogIdCandidates } = require('../services/publicAiBookingResolverService');

const c1 = expandCatalogIdCandidates('cabana-10');
assert.ok(c1.includes('cabana10'), 'cabana-10 debe generar cabana10');
assert.ok(c1.includes('casa-10'), 'cabana-10 debe generar casa-10 para cruce con hotelId');

const c2 = expandCatalogIdCandidates('cabana10');
assert.ok(c2.includes('cabana-10'), 'cabana10 debe generar cabana-10');

const c3 = expandCatalogIdCandidates('casa-10');
assert.ok(c3.includes('cabana10'), 'casa-10 debe generar cabana10');

const c4 = expandCatalogIdCandidates('depto-5');
assert.ok(!c4.includes('cabana-5'), 'depto no debe generar sinónimos cabana');

console.log('test-catalog-id-resolver-candidates: OK');
