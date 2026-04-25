const assert = require('assert');
const { expandCatalogIdCandidates } = require('../services/publicAiBookingResolverService');

const c1 = expandCatalogIdCandidates('cabana-10');
assert.ok(c1.includes('cabana10'), 'cabana-10 debe generar cabana10');
assert.ok(!c1.includes('casa-10'), 'no sinónimos semánticos casa/cabana');

const c2 = expandCatalogIdCandidates('cabana10');
assert.ok(c2.includes('cabana-10'), 'cabana10 debe generar cabana-10');

const c3 = expandCatalogIdCandidates('casa-10');
assert.ok(c3.includes('casa10'), 'casa-10 debe generar casa10');
assert.ok(!c3.includes('cabana10'), 'casa no debe mapear a cabana');

const c4 = expandCatalogIdCandidates('depto-5');
assert.ok(c4.includes('depto5'), 'depto-5 debe generar depto5');
assert.ok(c4.includes('depto-5'), 'depto-5 se conserva');
assert.ok(!c4.includes('cabana-5'), 'depto no debe generar cabana');

const c5 = expandCatalogIdCandidates('0123456789abcdef0123456789abcdef');
assert.ok(!c5.includes('01234567-89abcdef0123456789abcdef'), 'uuid colapsado: sin variantes inventadas');

console.log('test-catalog-id-resolver-candidates: OK');
