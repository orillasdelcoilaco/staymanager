/**
 * Contrato: la plantilla semilla del digest incluye etiquetas operativas actuales.
 */
const assert = require('assert');
const path = require('path');
const { readFileSync } = require('fs');

const seedPath = path.join(__dirname, '../../scripts/seed-plantillas-correos-transaccionales.js');
const src = readFileSync(seedPath, 'utf8');

[
    '[DIGEST_PAGO_PENDIENTE_VENCIDO]',
    '[DIGEST_LLEGADAS_MANANA_SIN_HORA_ESTIMADA]',
    '[DIGEST_ICAL_NUEVAS_RESERVAS_7D]',
    '[DIGEST_ICAL_SINCRONIZACIONES_CON_ERROR_7D]',
].forEach((tag) => {
    assert.ok(src.includes(tag), `Falta tag ${tag} en semilla de digest`);
});

console.log('test-seed-digest-template-tags: OK');

