/**
 * seo.js — Prompts para SEO y contenido de web pública
 *
 * Centraliza los prompts relacionados a:
 * - Metadatos SEO de la home page
 * - Contenido above the fold (h1, intro)
 * - Perfil de empresa (slogan, enfoque, palabras clave)
 */

const { withSsrCommerceObjective } = require('./ssrCommerceContext');

/**
 * Prompt para generar metadatos SEO de la home page de una empresa.
 *
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.historia
 * @param {string} p.slogan
 * @param {string} p.enfoqueMarketing
 * @param {string} p.tipoAlojamientoPrincipal
 * @returns {string}
 */
function promptSeoHomePage({ nombreEmpresa, historia, slogan, enfoqueMarketing, tipoAlojamientoPrincipal }) {
    return withSsrCommerceObjective(`Actúa como un Experto SEO Senior especializado en hospitalidad y turismo.

Genera los metadatos SEO para la página de inicio de este negocio:

- Empresa: "${nombreEmpresa}"
- Historia: "${historia}"
- Slogan: "${slogan}"
- Enfoque de marketing: "${enfoqueMarketing}"
- Tipo de alojamiento principal: "${tipoAlojamientoPrincipal}"

REGLAS:
1. "metaTitle": máximo 60 caracteres, incluir nombre de empresa y tipo de alojamiento.
2. "metaDescription": máximo 155 caracteres, orientada a conversión con CTA implícita.
3. Usar palabras clave naturales de turismo en español.
4. No usar mayúsculas excesivas ni caracteres especiales.

Responde SOLO JSON (sin markdown):
{
    "metaTitle": "...",
    "metaDescription": "..."
}`);
}

/**
 * Prompt para generar contenido above the fold de la home page.
 *
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.slogan
 * @param {string} p.enfoqueMarketing
 * @param {string} p.tipoAlojamientoPrincipal
 * @returns {string}
 */
function promptContenidoHomePage({ nombreEmpresa, slogan, enfoqueMarketing, tipoAlojamientoPrincipal }) {
    return withSsrCommerceObjective(`Actúa como Copywriter especializado en CRO (Conversion Rate Optimization) para turismo.

Genera el contenido principal de la página de inicio:

- Empresa: "${nombreEmpresa}"
- Slogan: "${slogan}"
- Enfoque de marketing: "${enfoqueMarketing}"
- Tipo de alojamiento: "${tipoAlojamientoPrincipal}"

REGLAS:
1. "h1": título impactante, máximo 8 palabras, orientado a la experiencia del huésped.
2. "introParagraph": 2-3 oraciones que transmitan emoción y propuesta de valor única.
3. No repetir el slogan exactamente en el h1.
4. Tono cálido, invitante, sin tecnicismos.

Responde SOLO JSON (sin markdown):
{
    "h1": "...",
    "introParagraph": "..."
}`);
}

/**
 * Prompt para generar el perfil de marca de una empresa.
 *
 * @param {object} p
 * @param {string} p.nombre
 * @param {string} p.historia
 * @param {string} p.contexto
 * @returns {string}
 */
function promptPerfilEmpresa({ nombre, historia, contexto }) {
    return withSsrCommerceObjective(`Actúa como Estratega de Marca especializado en hospitalidad y turismo.

Genera el perfil de marca para este negocio de arrendamiento:

- Empresa: "${nombre}"
- Historia base: "${historia}"
- Contexto adicional: "${contexto}"

REGLAS:
1. "slogan": memorable, máximo 8 palabras, en español.
2. "enfoqueMarketing": una palabra o frase corta (ej: "Naturaleza", "Lujo Accesible", "Familia").
3. "palabrasClaveAdicionales": 5-8 palabras clave SEO separadas por coma.
4. "tipoAlojamientoPrincipal": tipo exacto (ej: "Cabaña", "Departamento", "Casa de campo").
5. "historiaOptimizada": reescribir la historia en tono atractivo, máximo 150 palabras.
6. "heroAlt" y "heroTitle": para la imagen principal del sitio.

Responde SOLO JSON (sin markdown):
{
    "slogan": "...",
    "enfoqueMarketing": "...",
    "palabrasClaveAdicionales": "...",
    "tipoAlojamientoPrincipal": "...",
    "historiaOptimizada": "...",
    "heroAlt": "...",
    "heroTitle": "...",
    "advertencia": null
}`);
}

module.exports = { promptSeoHomePage, promptContenidoHomePage, promptPerfilEmpresa };
