/**
 * Alineado con `transactionalEmailFallbackSubjects.js` (i18n asuntos mínimos).
 * node backend/scripts/test-transactional-fallback-subjects.js
 */
const assert = require('assert');
const {
    fallbackAsuntoConsultaWebDefecto,
    fallbackSubjectForDisparador,
} = require('../services/transactionalEmailFallbackSubjects');

assert.strictEqual(fallbackAsuntoConsultaWebDefecto('es'), 'Consulta desde la web');
assert.strictEqual(fallbackAsuntoConsultaWebDefecto('en'), 'Message from your website');

assert.strictEqual(fallbackSubjectForDisparador('consulta_contacto', 'es'), 'Consulta recibida');
assert.strictEqual(fallbackSubjectForDisparador('consulta_contacto', 'en'), 'We received your message');

/** Misma regla que `_permiteCorreoAutomaticoHuesped` para `consulta_contacto` (categoría `consultasDesdeWeb`). */
function permiteAutorespuestaConsultaWeb(cats) {
    if (!cats || typeof cats !== 'object') return true;
    return cats.consultasDesdeWeb !== false;
}
assert.strictEqual(permiteAutorespuestaConsultaWeb(undefined), true);
assert.strictEqual(permiteAutorespuestaConsultaWeb({}), true);
assert.strictEqual(permiteAutorespuestaConsultaWeb({ consultasDesdeWeb: false }), false);
assert.strictEqual(permiteAutorespuestaConsultaWeb({ consultasDesdeWeb: true }), true);

console.log('test-transactional-fallback-subjects: OK');
