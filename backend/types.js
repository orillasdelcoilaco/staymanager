/**
 * @typedef {Object} SEOData
 * @property {string} title - Título optimizado para SEO (60 carácteres max).
 * @property {string} metaDescription - Descripción meta para buscadores (160 carácteres max).
 * @property {string} h1 - Encabezado principal de la página.
 */

/**
 * @typedef {Object} SSRData
 * @property {string} descripcionCorta - Descripción breve para tarjetas o listados.
 * @property {string} descripcionLarga - Descripción detallada para la página del espacio.
 */

/**
 * @typedef {Object} RequerimientoFoto
 * @property {string} activo - El activo que debe ser fotografiado (ej: "Cama").
 * @property {number} cantidad - Cantidad de fotos requeridas.
 * @property {string} metadataSugerida - Sugerencias para la toma (ej: "Vista frontal con luz natural").
 * @property {boolean} obligatoria - Si la foto es obligatoria para publicar.
 */

/**
 * @typedef {Object} PropuestaEspacio
 * @property {SEOData} seo - Datos para SEO.
 * @property {SSRData} ssr - Datos para Server Side Rendering.
 * @property {RequerimientoFoto[]} requerimientosFotos - Lista de fotos necesarias.
 * @property {number} tokensEstimados - Costo estimado de generación (simulado).
 */

/**
 * Genera toda la metadata, textos y requisitos de fotos para un espacio específico.
 * @param {string} tipo - Ej: 'Dormitorio', 'Cocina'
 * @param {string[]} activos - Ej: ['Cama King', 'TV 50"', 'Vista al mar']
 * @param {string} [detallesAdicionales] - Información extra del usuario.
 * @returns {PropuestaEspacio} - Objeto con textos SEO, SSR y guía de fotos.
 */
module.exports = {};
