/**
 * Prompts para generar plantillas de mensaje (correo/texto) con etiquetas del motor.
 * Lista de etiquetas: plantillasEtiquetasCatalog.js
 */

const { bloqueEtiquetasParaPrompt } = require('../../plantillasEtiquetasCatalog');

function bloqueEtiquetas() {
    return bloqueEtiquetasParaPrompt();
}

/**
 * @param {object} p
 * @param {string} p.nombreEmpresa
 * @param {string} p.tipoNombre — Nombre del tipo de plantilla (Firestore)
 * @param {string} p.nombreBorrador — Nombre interno sugerido por el usuario (puede vacío)
 * @param {string} p.instrucciones — Instrucciones libres sanitizadas
 */
function promptGenerarPlantillaMensaje({ nombreEmpresa, tipoNombre, nombreBorrador, instrucciones }) {
    const borrador = (nombreBorrador || '').trim() || '(sin sugerencia: inventa un nombre interno breve en español)';
    const extra = (instrucciones || '').trim() || 'Ninguna';

    return `Eres redactor/a de comunicaciones para alojamientos turísticos en español (Latinoamérica, neutro).

CONTEXTO
- Empresa: "${nombreEmpresa}"
- Tipo de plantilla (clasificación del negocio): "${tipoNombre}"
- Nombre interno sugerido por el usuario (mejóralo si es vago; si es bueno, respétalo): ${borrador}
- Instrucciones adicionales del usuario: ${extra}

OBJETIVO
Genera una plantilla de mensaje (cuerpo en texto plano) y un asunto de email acordes al TIPO indicado. Ejemplos de enfoque:
- Si el tipo sugiere propuesta u oferta: tono comercial claro, plazo o vencimiento, llamado a pagar o responder, datos de estadía.
- Si sugiere confirmación de reserva: tono tranquilizador, datos de fechas y alojamiento, contacto.
- Si sugiere recordatorio o post-estadía: breve, accionable.
- Si es genérico: mensaje profesional y cordial adaptable.

ETIQUETAS DEL MOTOR (OBLIGATORIO)
1. Solo puedes usar estas etiquetas EXACTAS (con corchetes). No inventes otras como {{variable}} ni [MI_ETIQUETA].
2. Incluye en el cuerpo al menos 5 etiquetas DISTINTAS relevantes al tipo de mensaje.
3. El asunto puede incluir 1–3 etiquetas si encaja (ej. [ALOJAMIENTO_NOMBRE], [CLIENTE_NOMBRE]).

LISTA VÁLIDA:
${bloqueEtiquetas()}

FORMATO DEL CUERPO
- Texto plano con saltos de línea.
- Puedes usar emojis con moderación (📌 ✅ ⚠️) para títulos de sección; el sistema los convierte a HTML.
- No inventes montos, fechas ni nombres reales: solo placeholders con etiquetas.
- Máximo ~450 palabras en el cuerpo.

SALIDA
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto fuera del JSON) con estas claves exactas:
{"nombre":"string breve para lista interna","asunto":"string","texto":"string multilínea"}`;
}

module.exports = { promptGenerarPlantillaMensaje };
