/**
 * image.js — Prompts para metadata y evaluación de imágenes
 *
 * Centraliza los prompts que requieren visión (Gemini):
 * - Metadata SEO de imágenes (altText, title) con buffer de imagen
 * - Evaluación de fotografías según requerimientos del wizard
 */

const { withSsrCommerceObjective, SSR_IMAGE_CONTEXT_REMINDER } = require('./ssrCommerceContext');

/**
 * Prompt para generar metadata SEO de una imagen.
 * Requiere visión: usar con GeminiProvider.generateVisionJSON()
 *
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.nombrePropiedad
 * @param {string} p.descripcionPropiedad
 * @param {string} p.nombreComponente — Nombre del espacio fotografiado
 * @param {string} p.tipoComponente — Categoría del componente
 * @param {string|null} p.contextoEsperado — Si viene del wizard, qué tipo de foto se pidió
 * @returns {string}
 */
function promptMetadataImagen({ nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente, contextoEsperado }) {
    const instruccionAuditoria = contextoEsperado
        ? `TAREA CRÍTICA DEL WIZARD: El usuario debe subir específicamente: "${contextoEsperado}".
Verifica si la imagen cumple con este requisito.
- Si se pide "Vista de la cama" y suben una vista general donde la cama apenas se ve: RECHÁZALO.
- Si se pide "Detalle del baño" y suben una foto panorámica: RECHÁZALO.
Si no cumple, "advertencia" debe decir exactamente: "No cumple con el requisito: ${contextoEsperado}".`
        : `AUDITORÍA GENERAL: ¿La foto corresponde al espacio "${tipoComponente}"?
- Si suben un baño para un componente "Dormitorio": DETECTARLO.
- Si la foto es borrosa o de muy baja calidad: DETECTARLO.`;

    return withSsrCommerceObjective(`Eres un Experto SEO para Google Hotels y un Auditor de Calidad Visual.

${SSR_IMAGE_CONTEXT_REMINDER}

CONTEXTO:
- Espacio fotografiado: "${nombreComponente}" (Categoría: ${tipoComponente})
- Propiedad: "${nombrePropiedad}" (Empresa: ${nombreEmpresa})
- Descripción de la propiedad: "${descripcionPropiedad}"

${instruccionAuditoria}

TAREAS:
1. "altText": texto alternativo optimizado para SEO (máximo 125 caracteres, en español).
2. "title": título comercial atractivo (máximo 60 caracteres, en español).
3. "advertencia": mensaje de error si no cumple auditoría. null si está correcto.

Responde SOLO JSON (sin markdown):
{
    "altText": "...",
    "title": "...",
    "advertencia": null
}`);
}

/**
 * Prompt para generar metadata SEO de una imagen con contexto corporativo completo.
 * Versión mejorada que incluye identidad de marca, valores, misión, etc.
 *
 * @param {object} p
 * @param {object} p.empresaContext - Contexto completo de empresa (desde getEmpresaContext)
 * @param {string} p.nombrePropiedad
 * @param {string} p.descripcionPropiedad
 * @param {string} p.nombreComponente — Nombre del espacio fotografiado
 * @param {string} p.tipoComponente — Categoría del componente
 * @param {string|null} p.contextoEsperado — Si viene del wizard, qué tipo de foto se pidió
 * @returns {string}
 */
function promptMetadataImagenConContexto({ empresaContext, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente, contextoEsperado }) {
    const instruccionAuditoria = contextoEsperado
        ? `TAREA CRÍTICA DEL WIZARD: El usuario debe subir específicamente: "${contextoEsperado}".
Verifica si la imagen cumple con este requisito.
- Si se pide "Vista de la cama" y suben una vista general donde la cama apenas se ve: RECHÁZALO.
- Si se pide "Detalle del baño" y suben una foto panorámica: RECHÁZALO.
Si no cumple, "advertencia" debe decir exactamente: "No cumple con el requisito: ${contextoEsperado}".`
        : `AUDITORÍA GENERAL: ¿La foto corresponde al espacio "${tipoComponente}"?
- Si suben un baño para un componente "Dormitorio": DETECTARLO.
- Si la foto es borrosa o de muy baja calidad: DETECTARLO.`;

    // Construir contexto corporativo
    const contextoCorporativo = `
CONTEXTO CORPORATIVO COMPLETO:
- Empresa: "${empresaContext.nombre || 'Sin nombre'}"
- Historia: "${empresaContext.historia || 'Sin historia registrada'}"
- Misión: "${empresaContext.mision || 'Sin misión registrada'}"
- Valores: ${Array.isArray(empresaContext.valores) && empresaContext.valores.length > 0
        ? empresaContext.valores.map(v => `"${v}"`).join(', ')
        : 'No especificados'}
- Slogan: "${empresaContext.slogan || 'Sin slogan'}"
- Propuesta de valor: "${empresaContext.brand?.propuestaValor || 'No especificada'}"
- Tono de comunicación: "${empresaContext.brand?.tonoComunicacion || 'profesional'}"
- Público objetivo: "${empresaContext.publicoObjetivo || 'General'}"
- Enfoque de marketing: "${empresaContext.enfoque || 'General'}"
- Ubicación: ${empresaContext.ubicacion?.ciudad || ''}, ${empresaContext.ubicacion?.region || ''}`;

    return withSsrCommerceObjective(`Eres un Experto SEO para Google Hotels y un Auditor de Calidad Visual.

${SSR_IMAGE_CONTEXT_REMINDER}

${contextoCorporativo}

CONTEXTO DE LA IMAGEN:
- Espacio fotografiado: "${nombreComponente}" (Categoría: ${tipoComponente})
- Propiedad: "${nombrePropiedad}"
- Descripción de la propiedad: "${descripcionPropiedad}"

${instruccionAuditoria}

TAREAS DE GENERACIÓN DE METADATOS (SEO):
1. "altText": Genera un texto alternativo optimizado para SEO (máximo 125 caracteres, en español) que combine:
   - Descripción visual precisa de lo que se ve en la imagen
   - Contexto de la propiedad y su ubicación
   - Identidad de marca de la empresa (tono, valores, propuesta de valor)
   - Palabras clave relevantes para el público objetivo de la empresa

2. "title": Un título comercial atractivo (máximo 60 caracteres, en español) que:
   - Sea persuasivo y orientado a conversión
   - Refleje el tono de comunicación de la marca
   - Incluya elementos de la propuesta de valor corporativa
   - Genere interés y curiosidad

3. "advertencia": Mensaje de error si no cumple auditoría. null si está correcto.

IMPORTANTE: El altText y title deben ser COHERENTES con la identidad de marca y el público objetivo.

Responde SOLO JSON (sin markdown):
{
    "altText": "...",
    "title": "...",
    "advertencia": null
}`);
}

/**
 * Prompt para evaluar fotografías según requerimientos del wizard.
 * Requiere visión con URLs: usar con GeminiProvider que soporte imageUrls.
 *
 * @param {object} p
 * @param {string} p.requerimientos — Descripción de los requisitos fotográficos
 * @param {string} p.nombrePropiedad
 * @param {string[]} p.fotosUrls — URLs de las fotos a evaluar
 * @returns {string}
 */
function promptEvaluacionFotografias({ requerimientos, nombrePropiedad, fotosUrls }) {
    const listaFotos = fotosUrls.map((url, i) => `Foto ${i + 1}: ${url}`).join('\n');

    return withSsrCommerceObjective(`Actúa como un Auditor de Calidad Fotográfica para alojamientos turísticos.

PROPIEDAD: "${nombrePropiedad}"

REQUERIMIENTOS FOTOGRÁFICOS A EVALUAR:
${requerimientos}

FOTOS A REVISAR:
${listaFotos}

INSTRUCCIONES:
1. Para cada requerimiento, indica si alguna de las fotos lo cumple.
2. Evalúa calidad técnica: iluminación, encuadre, resolución.
3. "cumple": true si la foto satisface el requerimiento.
4. "fotoIndex": índice (base 0) de la foto que mejor cumple, -1 si ninguna cumple.
5. "observacion": comentario breve sobre por qué cumple o no.

Responde SOLO un array JSON (sin markdown):
[
    {
        "requerimiento": "Descripción del requerimiento",
        "cumple": true,
        "fotoIndex": 0,
        "observacion": "..."
    }
]`);
}

module.exports = { promptMetadataImagen, promptMetadataImagenConContexto, promptEvaluacionFotografias };
