# Instrucciones para Gemini — smoke API pública StayManager / SuiteManager

**Uso:** copiar este bloque (y opcionalmente adjuntar **`openapi/openapi-gemini.yaml`** del repo) en Google AI Studio / Gemini como contexto para que **ejecute o proponga** pruebas HTTP contra el backend.

### Aclaraciones (evitar falsos positivos)

1. **Push a GitHub:** no hace falta **para probar** si `https://suitemanagers.com` ya apunta al backend en Render: los GET son al código **ya desplegado**. Hace falta **push + deploy** solo para **cambiar** el comportamiento del servidor (nuevo código). Los smoke HTTP los puede ejecutar Gemini / `curl` / navegador contra la URL pública mientras responda 200.
2. **`GET /api/public/version`:** el campo `version` del JSON es la **versión de contrato API pública** (p. ej. alineada a `info.version` del OpenAPI, por defecto **1.4.7** vía `PUBLIC_API_CONTRACT_VERSION` o constante en código), **no** el número de build de la app. Tras un deploy reciente, debe ser coherente con el YAML.
3. **`/ai/buscar-empresa` y `ready_for_sales`:** indica si la empresa está **lista para venta por canal/tarifas** en nuestro modelo; no es un campo oficial “apto Google Hotel Center” — el feed global partner tiene reglas adicionales (listado, geo, etc. en `TASKS/venta-ia.md` §7).
4. **Rutas distintas:** detalle rico para agentes: **`GET /api/alojamientos/detalle`** (prefijo `/api/`, no `/api/public/`) con `alojamiento_id` y opcionalmente `checkin` / `checkout`. Los paths bajo **`/api/public/*`** son el router `publicRoutes.js` (otro prefijo).
5. **JSON (API) vs XML (Google):** feeds partner en **`feeds.<domino>/feeds/google/*.xml`** con `?auth=` — no son el mismo formato que el JSON; validación distinta.

**No pegar secretos** en el chat: usa placeholders `BASE_URL`, `AGENT_KEY`.

---

## 1. Contrato OpenAPI

- Archivo en el repo: **`openapi/openapi-gemini.yaml`** (versión en `info.version`, ej. **1.4.7**).
- El campo **`servers.url`** del YAML puede estar desactualizado respecto a producción; **sustituir** siempre por la base real.

---

## 2. Sustituir variables

| Variable | Ejemplo producción | Notas |
|----------|-------------------|--------|
| `BASE_URL` | `https://suitemanagers.com` | Sin barra final. Si probáis staging Render: `https://xxxx.onrender.com`. |
| `AGENT_KEY` | *(valor en env servidor `AGENT_API_KEYS`)* | Solo para **POST** que llevan `requireAgentKey`. Header: **`X-Agent-API-Key`**. Opcional: **`X-Agent-Name: Gemini`**. Si en el servidor **no** hay claves configuradas, muchos POST pueden responder igualmente (modo abierto con rate limit); no asumirlo en prod. |

---

## 3. Secuencia de smoke (orden sugerido)

### A. Sin clave de agente (GET públicos)

1. **Versión desplegada**  
   `GET {BASE_URL}/api/public/version`  
   Esperado: JSON con `version`, `timestamp` (y/o campos documentados en OpenAPI).

2. **Buscar empresa (texto libre)**  
   `GET {BASE_URL}/ai/buscar-empresa?q=orillas`  
   (o nombre parcial del cliente)  
   Esperado: JSON con `success`, datos de empresa si existe, `ready_for_sales` / diagnóstico según contrato.

3. **Listado / búsqueda IA** (según rutas montadas en `publicRoutes` + OpenAPI)  
   Ejemplos típicos (confirmar path exacto en YAML):  
   - `GET {BASE_URL}/api/public/propiedades?empresaId=<UUID>`  
   - o búsqueda general si está documentada.

4. **Detalle de propiedad** (necesitás un `id` real de una propiedad del tenant)  
   `GET {BASE_URL}/api/public/propiedad/<PROPIEDAD_ID>?empresaId=<EMPRESA_ID>`  
   (query params exactos según OpenAPI / controlador.)

### B. Con clave de agente (POST — solo si el producto lo permite)

5. **Cotización dry-run**  
   `POST {BASE_URL}/api/public/reservas/cotizar`  
   Headers: `Content-Type: application/json`, `X-Agent-API-Key: <AGENT_KEY>`, `X-Agent-Name: Gemini`  
   Body: según OpenAPI (fechas, propiedad, huésped, empresa, etc.).

**No** ejecutar reservas reales en producción sin acuerdo; el dry-run no persiste si usáis solo **cotizar**.

---

## 4. Marketplace y dominios (no son la misma API)

- **Marketplace HTML:** `https://suitemanagers.com` — catálogo humano global, p. ej. `/google-hotels`.
- **SSR por empresa:** `https://<subdominio>.suitemanagers.com` o dominio propio (p. ej. `.cl`) si está configurado en la empresa.

Gemini puede **abrir URLs en navegador** si la herramienta lo permite; para **contrato estable** usar siempre **`BASE_URL` + rutas `/api/public/*` y `/ai/*`** según OpenAPI.

---

## 5. Qué pedirle explícitamente a Gemini

Texto sugerido (pegar después del contexto):

> Actúa como tester de API. Usa el OpenAPI adjunto (Gemini). Con `BASE_URL = …` y sin escribir claves en claro si el usuario prefiere variables de entorno: (1) confirma que GET `/api/public/version` responde 200; (2) GET `/ai/buscar-empresa` con una consulta de prueba; (3) si te pasan `empresaId` y `propiedadId`, llama al detalle público; (4) opcionalmente POST cotizar con headers de agente si el usuario autoriza. Resume status HTTP, fragmento del JSON y errores.

---

## 6. Feeds Google Partner (XML, otro host)

Los feeds globales **no** van en `openapi-gemini.yaml`: son  
`GET https://feeds.suitemanagers.com/feeds/google/properties.xml?auth=<TOKEN_PARTNER>`  
(mismo para `ari.xml`). Token: env servidor **`GOOGLE_PARTNER_FEED_AUTH_TOKEN`**. Host debe estar permitido (`feeds.<PLATFORM_DOMAIN>` o `GOOGLE_PARTNER_EXTRA_HOSTS`). Esto es **prueba operativa**, no extensión Gemini estándar.

---

*Última actualización: 2026-05-02*
