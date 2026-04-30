# Proveedores de IA (backend)

## Flujo por tarea

1. **Proveedor preferido por tarea** (`backend/services/ai/aiEnums.js`, `TASK_PROVIDER_MAP`).  
   Ejemplo: textos de propiedad / SEO usan **`groq`** por velocidad y coste.

2. **Cadena efectiva** (en orden, sin duplicados):

   `preferido` → `AI_FALLBACK_PROVIDERS` → `AI_PROVIDER` → **`AI_IMPLICIT_FALLBACKS`** (por defecto `gemini`).

   Esto corrige el caso en que solo quedaba **un** proveedor (p. ej. `[groq]` si `AI_PROVIDER=groq` y la tarea ya prefería Groq): sin el paso implícito, **no había segundo proveedor** y un fallo puntual dejaba la cola vacía.

3. Entre cada proveedor se espera **`AI_CHAIN_DELAY_MS`** ms (por defecto `320`) para reducir ráfagas ante límites de tasa.

4. Si un proveedor lanza **`AI_QUOTA_EXCEEDED`**, se prueba el siguiente.

5. Otros errores HTTP/red en proveedores compatibles OpenAI ya **no cortan** toda la cadena: se registra un warning y se sigue (antes solo algunos caminos hacían fallback).

## Variables de entorno relevantes

| Variable | Rol |
|----------|-----|
| `AI_PROVIDER` | Proveedor “por defecto” del proceso (`gemini`, `groq`, `openai`, …). Va en la cadena antes que los implícitos. |
| `AI_FALLBACK_PROVIDERS` | Lista separada por comas, probada después del preferido de la tarea. Ej: `gemini,openrouter`. |
| `AI_IMPLICIT_FALLBACKS` | Por defecto `gemini`. Se añade al final si aún no está en la cadena. Desactivar: `0` o `false`. |
| `AI_CHAIN_DELAY_MS` | Pausa entre intentos de proveedores distintos (ms). `0` desactiva. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, … | Ver `backend/config/aiConfig.js`. |

## Recomendaciones para producción

- Definir **al menos dos claves** entre Groq + Gemini u OpenRouter para redundancia.
- Si solo usás Groq: mantener **`AI_IMPLICIT_FALLBACKS=gemini`** y configurar `GEMINI_API_KEY`, o añadir **`AI_FALLBACK_PROVIDERS=gemini`**.
- Para contenido largo (narrativas), Groq usa `maxTokens` alto en `aiConfig.groq`; si ves JSON cortado, revisar logs del proveedor.

## Archivos clave

- `backend/config/aiConfig.js` — definición de proveedores y env.
- `backend/services/ai/aiEnums.js` — mapa tarea → proveedor preferido.
- `backend/services/aiContentService.js` — `generateForTask` y cadena.
- `backend/services/ai_providers/openaiProvider.js` — Groq/OpenRouter/OpenAI (JSON robusto + reintento sin `json_mode` si hace falta).
