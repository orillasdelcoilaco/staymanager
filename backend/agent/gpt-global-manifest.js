/**
 * @fileoverview GPT Global Manifest (Marketplace Agent)
 * Final Configuration for Rezerva IA — Buscador Global.
 */

const _PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'rezerva.cl';

const GPT_GLOBAL_MANIFEST = {
    "schema_version": "v1",
    "name_for_human": "Rezerva IA — Buscador Global",
    "name_for_model": "rezerva_global",
    "description_for_human": "Busca alojamientos disponibles en Chile en todo el ecosistema Rezerva IA.",
    "description_for_model": `Eres un asistente global conectado al backend de Rezerva IA en ${_PLATFORM_DOMAIN}. Usas Actions para detectar intención, filtrar disponibilidad y mostrar fotos optimizadas. Nunca procesas imágenes, nunca inventas. Mantienes las respuestas cortas y orientadas a la reserva.`,
    "auth": {
        "type": "none"
    },
    "api": {
        "type": "openapi",
        "url": `https://${_PLATFORM_DOMAIN}/api/openapi-global.json`
    },
    "instructions": `
"Eres el Asistente Global de Reservas de Rezerva IA.

Tu objetivo: encontrar alojamiento disponible rápido, sin hacer preguntas innecesarias y siempre orientado a la reserva.

Reglas:
1. Usa siempre las Actions del backend (${_PLATFORM_DOMAIN}).
2. Antes de responder llama a 'detectar_intencion'.
3. Si el usuario dice 'este fin de semana', calcula automáticamente:
   - viernes próximo (check-in)
   - domingo próximo (check-out)
4. Solo pregunta '¿para cuántas personas?' si falta ese dato.
5. No pidas fechas si ya se pueden deducir.
6. Consulta disponibilidad solo cuando tengas fechas + personas.
7. No inventes información. Usa solo lo que te da el backend.
8. No proceses imágenes, no uses visión. Solo muestra URLs recibidas.
9. Muestra máximo 2 fotos preview por alojamiento.
10. Si piden más fotos, usa 'ver_mas_fotos'.
11. Mantén las respuestas breves y orientadas a reservar.
12. Termina siempre con: '¿Deseas reservar esta opción?' "
  `,
    "actions": [
        {
            "name": "detectar_intencion",
            "description": "Detecta la intención del mensaje sin IA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mensaje": { "type": "string" }
                },
                "required": ["mensaje"]
            }
        },
        {
            "name": "buscar_disponibilidad",
            "description": "Consulta disponibilidad filtrada por fechas, personas y ubicación.",
            "parameters": {
                "type": "object",
                "properties": {
                    "personas": { "type": "number" },
                    "fecha_entrada": { "type": "string" },
                    "fecha_salida": { "type": "string" },
                    "ubicacion": { "type": "string" }
                },
                "required": ["personas", "fecha_entrada", "fecha_salida"]
            }
        },
        {
            "name": "ver_mas_fotos",
            "description": "Obtiene más fotos optimizadas sin usar visión.",
            "parameters": {
                "type": "object",
                "properties": {
                    "alojamientoId": { "type": "string" },
                    "tipo": { "type": "string" }
                },
                "required": ["alojamientoId", "tipo"]
            }
        }
    ]
};

module.exports = GPT_GLOBAL_MANIFEST;
