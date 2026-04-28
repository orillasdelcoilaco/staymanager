/**
 * Validación de URL para descarga del manual PDF (sin red).
 */
const assert = require('assert');
const { esUrlDescargaPdfPermitida } = require('../services/reservaWebManualPdfAdjuntoService');
const { htmlBloqueEnlacePdfManual } = require('../services/emailPdfEnlaceHtml');

assert.strictEqual(esUrlDescargaPdfPermitida(''), false);
assert.strictEqual(esUrlDescargaPdfPermitida('http://evil.com/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://localhost/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://127.0.0.1/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://10.0.0.1/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://192.168.1.1/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://172.20.0.1/x.pdf'), false);
assert.strictEqual(esUrlDescargaPdfPermitida('https://cdn.example.com/docs/manual.pdf'), true);

const bloque = htmlBloqueEnlacePdfManual('https://cdn.example.com/docs/manual.pdf', 'es');
assert.ok(bloque.includes('https://cdn.example.com/docs/manual.pdf'));
assert.ok(bloque.includes('Manual del huésped'));

console.log('test-reserva-web-manual-pdf-adjunto-url: OK');
