/**
 * Prompt para borrador de artículo del blog del sitio público (respuesta JSON).
 */

function promptBlogPostDraft({ factsBlock, includeReelScript, entryTypeLabel }) {
    const reelBlock = includeReelScript
        ? `
7) "reelScript": objeto con:
   - "hook3s": texto muy corto para los primeros 3 segundos (vertical).
   - "scenes": array de 5 a 8 strings (texto en pantalla o voz en off por escena).
   - "cta": cierre con llamada suave a reservar o visitar el sitio (sin inventar URLs; menciona "sitio oficial" o "reservas directas").
   - "hashtags": array de 4 a 8 hashtags relevantes (sin spam genérico).
Si no aplica reel, devuelve reelScript como null.
`
        : `
7) "reelScript": null
`;

    return `Eres redactor SEO para el blog del sitio web oficial de un alojamiento (una sola empresa).
Tipo de entrada: ${entryTypeLabel || 'general'}.

REGLAS (obligatorias):
- Usa SOLO hechos del bloque "DATOS VERIFICADOS". No inventes precios, horarios de terceros, cupones, códigos, porcentajes ni fechas que no estén en ese bloque.
- Si falta un dato operativo (horario de un parque, precio de ticket, clima exacto), indica que conviene confirmar en fuente oficial o al viajar, sin inventar cifras.
- Tono cálido, claro, orientado a huéspedes. Sin keyword stuffing.
- Estructura útil: introducción, secciones con subtítulos, bullets cuando ayuden, y una sección breve FAQ (3-5 preguntas) al final.
- No menciones "IA", "ChatGPT" ni el proveedor. No uses jerga interna tipo "wizard" o "buildContext".
- Incluye 1-2 menciones naturales del nombre comercial de la empresa desde DATOS VERIFICADOS.
- HTML permitido en el cuerpo: p, h2, h3, ul, li, strong, em, br solamente. Sin estilos inline, sin iframes, sin scripts.

DATOS VERIFICADOS (fuente de verdad):
---
${factsBlock}
---

Responde ÚNICAMENTE con un JSON válido (sin markdown) con estas claves:
1) "title": string — título H1 sugerido (≤70 caracteres).
2) "slug": string — slug URL en minúsculas, guiones, sin acentos (≤80 caracteres).
3) "metaDescription": string — meta description (≤155 caracteres).
4) "excerpt": string — resumen para listados (≤220 caracteres).
5) "bodyHtml": string — artículo completo en HTML con las etiquetas permitidas.
6) "faq": array de objetos { "q": string, "a": string } (opcional, puede ser []).
${reelBlock}

Idioma del contenido: el mismo que indique "Idioma principal del sitio" en DATOS VERIFICADOS (español o inglés).`;
}

module.exports = { promptBlogPostDraft };
