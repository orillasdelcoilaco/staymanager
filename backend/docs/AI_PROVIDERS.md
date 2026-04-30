# Proveedores de IA (backend)

## Flujo por tarea

1. **Proveedor preferido por tarea** (`TASK_PROVIDER_MAP` en `backend/services/ai/aiEnums.js`). Ej.: narrativa / SEO texto → **`groq`**.

2. **Cadena amplia (`buildJsonTaskProviderChain` en `backend/services/aiProviderChain.js`)** — orden sin duplicados, **solo proveedores con API key en env**:

   `preferido` → **`AI_CRITICAL_PROVIDER_CHAIN`** (por defecto **8** backends distintos: groq, gemini, openrouter, siliconflow, moonshot, deepseek, openai, claude) → `AI_FALLBACK_PROVIDERS` → `AI_PROVIDER` → `AI_IMPLICIT_FALLBACKS`.

   Así se intentan **≥6 proveedores distintos** en cuanto existan claves en Render (una por variable en `aiConfig.js`). Sin clave, ese backend **no entra** en la cadena (no pierdes tiempo).

3. Entre cada proveedor: **`AI_CHAIN_DELAY_MS`** (por defecto `280`) para no disparar ráfagas ante 429.

4. **`AI_QUOTA_EXCEEDED`** → siguiente proveedor.

5. Errores HTTP/red en adapters OpenAI-compatibles: warning y siguiente.

## Variables de entorno relevantes

| Variable | Rol |
|----------|-----|
| `AI_CRITICAL_PROVIDER_CHAIN` | Lista separada por comas (orden de fallback tras el preferido). Por defecto ocho IDs: groq, gemini, openrouter, siliconflow, moonshot, deepseek, openai, claude. Solo se usan si existe la env correspondiente (`GROQ_API_KEY`, `GEMINI_API_KEY`, …). |
| `AI_LOG_PROVIDER_CHAIN` | Pon `0` para silenciar el log único al arrancar la primera tarea JSON con la cadena resuelta. |
| `AI_PROVIDER` | Proveedor global del proceso; entra en la cadena si tiene clave. |
| `AI_FALLBACK_PROVIDERS` | Extra tras la cadena crítica. Ej: `gemini,openrouter`. |
| `AI_IMPLICIT_FALLBACKS` | Por defecto `gemini`. Desactivar: `0` o `false`. |
| `AI_CHAIN_DELAY_MS` | Pausa entre proveedores (ms). `0` desactiva. |
| **Rate limit panel** (`backend/middleware/aiPanelGenerationLimiter.js`) | |
| `AI_PANEL_WINDOW_MS` | Ventana (default **900000** = 15 min). |
| `AI_PANEL_HEAVY_MAX` | Máx. solicitudes “pesadas” por empresa / ventana (narrativa, JSON-LD, plan fotos, perfil, reclasificar, texto IA…). Default **14**. |
| `AI_PANEL_LIGHT_MAX` | Máx. solicitudes “ligeras” (audit-slot, subidas con metadatos IA). Default **45**. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, … | Ver `backend/config/aiConfig.js`. |

## Pasos para activar proveedores que faltan (sin cambiar código)

1. **Crear cuenta** en el portal del proveedor y generar una **API key**.
2. En **Render** → tu servicio → **Environment** → añadir la variable indicada (mismo nombre que en local `.env`).
3. **Redeploy** (o reinicio manual) para que el proceso cargue la nueva variable.
4. Opcional: **`AI_CRITICAL_PROVIDER_CHAIN`** para fijar el orden de intentos (coma-separada). Solo cuentan los IDs que tengan clave.

| Proveedor | Variable en env | Dónde obtener la clave |
|-----------|-----------------|-------------------------|
| Groq | `GROQ_API_KEY` | https://console.groq.com |
| Gemini | `GEMINI_API_KEY` | Google AI Studio / Google Cloud |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai |
| SiliconFlow | `SILICONFLOW_API_KEY` | https://siliconflow.cn |
| Moonshot | `MOONSHOT_API_KEY` | https://platform.moonshot.cn |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com |
| Claude | `CLAUDE_API_KEY` | https://console.anthropic.com |

Modelos opcionales por proveedor: `GROQ_MODEL`, `GEMINI_MODEL`, `OPENROUTER_MODEL`, etc. (ver `backend/config/aiConfig.js`).

## Recomendaciones para producción

- Configurar **varias claves** (Groq + Gemini + OpenRouter + SiliconFlow + Moonshot + DeepSeek + OpenAI + Claude según presupuesto). La cadena crítica las recorre en orden.
- Revisar **`AI_PANEL_*`** si el equipo necesita más pulsaciones por ventana o menos en demos.

## Archivos clave

- `backend/config/aiConfig.js` — definición de proveedores y env.
- `backend/services/ai/aiEnums.js` — mapa tarea → proveedor preferido.
- `backend/services/aiProviderChain.js` — cadena larga y filtro por claves.
- `backend/middleware/aiPanelGenerationLimiter.js` — 429 por empresa en rutas IA del panel.
- `backend/services/aiGenerateForTask.js` — `generateForTask` / `generateWithFallback`; cadena en `aiProviderChain.js`.
- `backend/services/ai_providers/openaiProvider.js` — Groq/OpenRouter/OpenAI (JSON robusto + reintento sin `json_mode` si hace falta).
- `backend/services/aiResponseNormalize.js` — aliases de campos (`descripcion` vs `texto`), búsqueda de espacios por `id` con `String()`, desenvuelve JSON-LD anidado.

## Dónde se llama a la IA (SPA / API relevantes)

Montaje real de `/api/website`: **`backend/api/ssr/config.routes.js`**. Resumen: **`backend/docs/WEBSITE_ROUTES_AUDIT.md`**.

| Superficie | Endpoint / servicio | Notas |
|------------|---------------------|--------|
| Paso 1 web — narrativa | `POST .../build-context/generate-narrativa` | Valida texto con `pickFirstString`; sync `websiteData` en Postgres. |
| Paso 1 — texto / puntos | `POST .../generate-ai-text` | Narrativa desde inventario + fallback controlado. |
| Paso 3 — SEO / JSON-LD | `POST .../build-context/generate-jsonld` | `validatePreGenerationData` (400 si bloquea); `unwrapSeoJsonLdResult` + segundo intento; galería PG + `spacesToContainsPlace`; `validateJsonLd` en log. |
| Galería — plan fotos | `POST .../generar-plan-fotos` | `fotoPlanIAHelpers` + plan por reglas. |
| Áreas comunes | `POST .../areas-comunes/:espacioId/generate-description` | `findEntityByIdLoose` + varias claves de texto. |
| Perfil empresa | `POST /website/optimize-profile` | `generarPerfilEmpresa(historia, getEmpresaContext)` |
| CRM borradores | `POST /api/.../crm/...` | `generateForTask` CRM |
| Plantillas motor | `plantillasService.generarPlantillaConIa` | Varias claves para `texto` / `asunto`. |
| Wizard alojamiento | `POST /api/ai/generate-structure` | `generarEstructuraAlojamiento` (resuelve `tipoId` en servidor). |
