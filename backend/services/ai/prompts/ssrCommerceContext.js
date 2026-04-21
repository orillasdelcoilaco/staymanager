/**
 * Objetivo único del pipeline propiedad → sitio público SSR.
 * Se antepone a prompts de IA para alinear inventario, fotos, narrativa y SEO
 * con venta directa, buscadores, redes y asistentes.
 */

const SSR_COMMERCE_OBJECTIVE = `
=== OBJETIVO DEL PRODUCTO (StayManager — sitio público SSR) ===
En StayManager, la gestión de propiedades (activos → espacios → alojamiento), la galería de fotos, el contenido web del wizard y la configuración web convergen en **páginas públicas renderizadas en el servidor (SSR)** por alojamiento y por marca.

Tu salida debe estar pensada para que esas páginas:
1) **Vendan** (reserva directa): copy persuasivo, prueba social, diferenciadores reales del inventario verificado.
2) **Sean encontradas** en buscadores y en experiencias con IA (SGE, Perplexity, etc.): términos de búsqueda naturales, coherencia con ubicación y tipo de alojamiento, datos estructurados cuando el prompt pide JSON-LD.
3) **Funcionen en redes sociales**: títulos y descripciones útiles como vista previa al compartir (meta/OG del HTML).
4) **Sean honestas**: no inventes amenidades, vistas ni servicios que no estén respaldados por espacios/activos o fotos descritas.

Nota técnica: **robots.txt** y **sitemap.xml** del sitio público los genera el backend de forma automática según alojamientos listados; no los generas tú en JSON, pero el texto y el schema que produces deben dejar cada URL lista para indexación y para que un crawler o un asistente entienda qué se ofrece y a quién va dirigido.
=== FIN OBJETIVO ===
`.trim();

/** Recordatorio corto para metadatos de imagen (tokens acotados). */
const SSR_IMAGE_CONTEXT_REMINDER =
    'Contexto: estas etiquetas alimentan la ficha pública SSR (Google Imágenes, accesibilidad y previews al compartir). Sé preciso y comercial sin inventar lo que no se ve.';

/**
 * @param {string} promptBody — cuerpo del prompt (sin este bloque)
 * @returns {string}
 */
function withSsrCommerceObjective(promptBody) {
    return `${SSR_COMMERCE_OBJECTIVE}\n\n${String(promptBody || '').trim()}`;
}

module.exports = {
    SSR_COMMERCE_OBJECTIVE,
    SSR_IMAGE_CONTEXT_REMINDER,
    withSsrCommerceObjective,
};
