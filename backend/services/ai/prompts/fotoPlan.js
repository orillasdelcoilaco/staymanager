/**
 * backend/services/ai/prompts/fotoPlan.js
 *
 * Prompt para generar el plan de fotos de una propiedad específica.
 * El plan maximiza conversión OTAs, SEO de imágenes indexables y CTR.
 * Output: { [componentId]: [ { description, guidelines, priority, required } ] }
 */
const { withSsrCommerceObjective } = require('./ssrCommerceContext');

/**
 * @param {Object} params
 * @param {string} params.propiedadNombre
 * @param {string} params.propiedadTipo — cabaña, departamento, casa, etc.
 * @param {string} params.ubicacion     — ciudad, región, país
 * @param {Array}  params.espacios      — [ { id, nombre, tipo, activos: [{ nombre, cantidad }] } ]
 * @returns {string}
 */
function promptPlanFotos({ propiedadNombre, propiedadTipo, ubicacion, espacios }) {
    const espaciosJson = espacios.map(e => ({
        id: e.id,
        nombre: e.nombre,
        tipo: e.tipo,
        activos: (e.activos || []).map(a => ({ nombre: a.nombre, cantidad: a.cantidad || 1 })),
    }));

    return withSsrCommerceObjective(`Eres un Fotógrafo Experto en Real Estate para plataformas turísticas (Airbnb, Booking.com, Google Hotels).
Tu misión es definir exactamente qué fotos necesita este alojamiento para maximizar conversión de reservas,
posicionamiento SEO de imágenes y la primera impresión del viajero.

ALOJAMIENTO:
- Nombre: "${propiedadNombre}"
- Tipo: ${propiedadTipo || 'alojamiento turístico'}
- Ubicación: ${ubicacion || 'no especificada'}

ESPACIOS CON INVENTARIO REAL:
${JSON.stringify(espaciosJson, null, 2)}

INSTRUCCIONES:
Para cada espacio, genera entre 2 y 6 shots según su importancia y complejidad.
Prioriza activos de alto impacto visual (camas, vistas, amenidades premium como tinas, chimeneas, jacuzzis).
No repitas shots obvios entre espacios.
Usa el idioma de los datos (español si los datos están en español).

REGLAS POR SHOT:
- "description": frase corta y accionable (máx 70 caracteres), clara para el fotógrafo
- "guidelines": instrucciones técnicas de ángulo, luz, composición (1-2 oraciones)
- "priority": "Alta" si vende o posiciona (camas, amenidades premium, vistas), "Media" para el resto
- "required": true para los 1-3 shots esenciales de cada espacio, false para los adicionales

RESPONDE SOLO con JSON válido (sin markdown):
{
  "[id del espacio tal cual fue entregado]": [
    {
      "description": "...",
      "guidelines": "...",
      "priority": "Alta",
      "required": true
    }
  ]
}

IMPORTANTE: Las claves del JSON deben ser exactamente los "id" de los espacios entregados.`);
}

module.exports = { promptPlanFotos };
