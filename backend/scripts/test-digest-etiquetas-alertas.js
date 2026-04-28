/**
 * Contrato: etiquetas [DIGEST_*] para alertas operativas.
 */
const assert = require('assert');
const { buildReemplazoMap } = require('../services/plantillasEtiquetasCatalog');

const m = buildReemplazoMap({
    digestIcalNuevasReservas7d: 3,
    digestIcalSincronizacionesConError7d: 1,
    digestLlegadasMananaSinHoraEstimada: 4,
    digestPagoPendienteVencido: 2,
});

assert.strictEqual(m['[DIGEST_ICAL_NUEVAS_RESERVAS_7D]'], 3);
assert.strictEqual(m['[DIGEST_ICAL_SINCRONIZACIONES_CON_ERROR_7D]'], 1);
assert.strictEqual(m['[DIGEST_LLEGADAS_MANANA_SIN_HORA_ESTIMADA]'], 4);
assert.strictEqual(m['[DIGEST_PAGO_PENDIENTE_VENCIDO]'], 2);

console.log('test-digest-etiquetas-alertas: OK');

