/**
 * Contrato bandeja: evento alineado con `enviarPorDisparador` (smoke §2 ítem 5).
 */
const assert = require('assert');
const { EVENTO_POR_DISPARADOR } = require('../services/transactionalEmailService');

assert.strictEqual(
    EVENTO_POR_DISPARADOR.reserva_confirmada,
    'reserva-confirmada',
    'filtro /comunicaciones debe usar el mismo evento que transactionalEmailService',
);

console.log('test-confirmacion-reserva-comunicaciones: OK');
