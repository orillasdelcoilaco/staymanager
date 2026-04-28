/**
 * Smoke: forma mínima del XML Transaction generado para ARI (vacío y con Property).
 */
const assert = require('assert');
const { assertAriTransactionWellFormed } = require('../services/ariFeedXmlSanity');

const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?><Transaction timestamp="2026-01-01T00:00:00.000Z" id="ari-update"><Result/></Transaction>`;
let r = assertAriTransactionWellFormed(emptyFeed);
assert.strictEqual(r.ok, true, r.errors.join(','));

const withProperty = `<?xml version="1.0" encoding="UTF-8"?>
<Transaction timestamp="2026-01-01T00:00:00.000Z" id="x">
  <Result>
    <Property id="H1"><Name>Test</Name></Property>
  </Result>
</Transaction>`;
r = assertAriTransactionWellFormed(withProperty);
assert.strictEqual(r.ok, true, r.errors.join(','));

r = assertAriTransactionWellFormed('<foo/>');
assert.strictEqual(r.ok, false);
assert.ok(r.errors.length > 0);

console.log('test-ari-feed-xml-sanity: OK');
