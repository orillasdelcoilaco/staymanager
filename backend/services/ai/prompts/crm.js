/**
 * crm.js — Prompts para CRM: campañas, mensajes y borradores
 *
 * Centraliza los prompts relacionados a:
 * - Redacción de campañas de email
 * - Generación de mensajes para clientes
 * - Borradores de comunicaciones comerciales
 */

/**
 * Prompt para redactar una campaña de email/WhatsApp.
 *
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.objetivo — Ej: "recuperar clientes inactivos", "promoción temporada alta"
 * @param {string} p.canal — "email" | "whatsapp" | "sms"
 * @param {string} p.tono — Ej: "formal", "cercano", "urgente"
 * @param {string} [p.detallesExtra] — Descuento, fechas, condiciones especiales
 * @returns {string}
 */
function promptCampanaMensaje({ nombreEmpresa, objetivo, canal, tono, detallesExtra = '' }) {
    const longitudPorCanal = {
        email: 'máximo 300 palabras total',
        whatsapp: 'máximo 3 párrafos cortos, lenguaje natural',
        sms: 'máximo 160 caracteres',
    };
    const instruccionLongitud = longitudPorCanal[canal] || 'máximo 200 palabras';

    return `Actúa como un Experto en Marketing Digital para negocios de turismo y arrendamiento.

Redacta un mensaje de ${canal} para la siguiente campaña:

- Empresa: "${nombreEmpresa}"
- Objetivo de la campaña: "${objetivo}"
- Tono: "${tono}"
- Detalles adicionales: "${detallesExtra || 'Ninguno'}"
- Restricción de longitud: ${instruccionLongitud}

REGLAS:
1. Asunto (solo para email): máximo 50 caracteres, generar curiosidad.
2. Cuerpo: directo al valor, con CTA claro al final.
3. No usar lenguaje demasiado formal ni corporativo si el tono es "cercano".
4. No inventar descuentos o condiciones que no estén en "detallesExtra".
5. Incluir espacio para personalizar con [NOMBRE_CLIENTE] si aplica.

Responde SOLO JSON (sin markdown):
{
    "asunto": "... (solo para email, vacío si es otro canal)",
    "cuerpo": "...",
    "cta": "Texto del llamado a la acción"
}`;
}

/**
 * Prompt para generar un borrador de respuesta a una consulta de cliente.
 *
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.consultaCliente — Texto de la consulta recibida
 * @param {string} p.contexto — Información disponible para responder
 * @param {string} [p.tono]
 * @returns {string}
 */
function promptRespuestaConsulta({ nombreEmpresa, consultaCliente, contexto, tono = 'amable y profesional' }) {
    return `Actúa como Asistente de Atención al Cliente para un negocio de arrendamiento turístico.

Empresa: "${nombreEmpresa}"
Tono deseado: "${tono}"

CONSULTA RECIBIDA DEL CLIENTE:
"${consultaCliente}"

INFORMACIÓN DISPONIBLE PARA RESPONDER:
"${contexto}"

REGLAS:
1. Responde SOLO lo que se puede confirmar con la información disponible.
2. Si no tienes información suficiente, indícalo amablemente y sugiere contactar directamente.
3. No prometas disponibilidad, precios o condiciones que no estén en el contexto.
4. Máximo 150 palabras.

Responde SOLO JSON (sin markdown):
{
    "respuesta": "...",
    "requiereRevisionHumana": false,
    "motivoRevision": null
}`;
}

module.exports = { promptCampanaMensaje, promptRespuestaConsulta };
