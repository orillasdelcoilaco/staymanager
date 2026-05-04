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

### 6.1 Después de que `properties` + `ari` den 200 (qué falta para “Google Hotels” completo)

| Qué | Cómo | Notas |
|-----|------|--------|
| Partner **estricto** | Misma máquina: `GH_PARTNER_FEED_BASE_URL`, `GH_PARTNER_FEED_AUTH_TOKEN`, luego `GH_PARTNER_FEED_STRICT=1 npm run smoke:partner-feeds` | Falla si no hay `<Property>` en alguno de los dos XML (datos panel / geo / listado). |
| Feed **contenido por tenant** | `GH_FEED_BASE_URL=https://<host-tenant>` y si aplica `GH_FEED_TOKEN=…` → `npm run smoke:google-hotels-tenant` | Script `verify-google-hotels-feed-checklist.js` — §9 de `TASKS/checklist-onboarding-google-hotel-center.md`. |
| Ayuda SSR | `GET {host-tenant}/widget-reserva-ayuda.json` — bloque `googleHotelsContentFeed` | Lo comprueba el script anterior. |
| Catálogo plataforma | Navegador: `https://suitemanagers.com/google-hotels` (y `?lang=en` si aplica) | §7.6 / marketplace. |
| Hotel Center | Consola Google: URLs finales, mapeo, validación | Fuera del repo; orden **Secuencia B** en `TASKS/google-hotels-partner-deploy-checklist.md`; onboarding §4–§8 en `checklist-onboarding-google-hotel-center.md`. |

---

## 7. Hotel Center, ARI “OTA” y deep links (cuando Gemini u otro asesor sugieren revisar)

**1) Acceso a Hotel Center**  
Correcto: tras el *interest form* / onboarding, Google habilita trabajo en **Hotel Center** (carga de **Hotel List** / URLs de **ARI**, mapeo de propiedades, validaciones). Eso **no** se automatiza desde el repo; seguir la guía de Google y `TASKS/checklist-onboarding-google-hotel-center.md`.

**2) “OTA_HotelRateAmountNotifRQ” y nodos `Tax`**  
En SuiteManager el ARI para Google (`generateAriFeed` en `backend/services/googleHotelsService.js`) emite un **subconjunto** bajo `<Transaction>…<Result>…<Property>…<RoomData>` con `<Inventory>`, `<Rate>`, `<Baserate currency="…" all_inclusive="true">` (estrategia **B** de `venta-ia.md` §7.9: precio final con impuestos en el baserate, **sin** hijos `<Tax>` explícitos).  
Eso **no** reproduce necesariamente el sobre XML completo **OTA_HotelRateAmountNotifRQ** de un OTA clásico; la validación fuerte es la **documentación / XSD del programa Google Hotels** (`hotel_inventory.xsd` o el que indique Google) — ver **`TASKS/venta-ia.md` §7.10** (`GOOGLE_HOTELS_XSD_PATH` + `xmllint` en el entorno de deploy cuando toque certificación).  
Pedir a un LLM “revisar OTA_HotelRateAmountNotifRQ” **sin** pegar el XSD oficial y el XML real suele dar **falsos positivos/negativos**; mejor: `xmllint --noout --schema … archivo.xml` cuando tengan el esquema.

**3) Deep link con fechas (Price Accuracy)**  
La ficha pública **`/propiedad/:id`** ya acepta query de fechas vía `website.property.helpers.js` (`fechaLlegada`, `fechaSalida`, alias `checkin` / `checkout`, `nights`, etc.).  
En el **Property List global**, el `<DeepLink>` hoy es la **URL base** de la ficha **sin** fechas (`googleHotelsGlobalService.js`): Google puede añadir parámetros al abrir desde su UI; si en certificación exigen **siempre** fechas en el enlace del feed, habría que **extender** la generación del `DeepLink` (decisión de producto: fechas por defecto vs. riesgo de desalinear con el rango que el usuario eligió en Google).

---

## 8. Checklist de validación “Entity Matching” + ARI (texto copiable para Gemini / asesores)

**Referencia de código:** `googleHotelsGlobalService.js` (Property List **global**), `googleHotelsService.js` (`generateAriFeed`, también tenant + merge global ARI).

### 8.1 Hotel List (feed de propiedades — partner global `/feeds/google/properties.xml`)

| Pregunta típica | Comportamiento SuiteManager |
|------------------|------------------------------|
| **`<Property id>`** | En el feed **global**, `id` es el **UUID de PostgreSQL `propiedades.id`** (estable, alineado con deep link `/propiedad/:id` y con el ARI global cuando `partnerXmlIdsFromDatabase`). **`googleHotelData.hotelId`** no va en el atributo `id` aquí; sí debe estar en metadata para mapeo en Hotel Center. En el feed **tenant** `feed-google-hotels-content.xml`, el código usa **`hotelId`** como `Property id` (`generatePropertyListFeed`) — son dos convenciones según feed; para partner único importa el **global**. |
| **`<Name>`** | Nombre de la propiedad (`propiedades.nombre`). |
| **`<Address format="simple">`** | Desglose: `<addr1>`, `<city>`, `<province>` (si hay `region` en metadata/empresa), `<postal_code>` si hay código, `<country>`. Resolución: `googleHotelsEmpresaAddress.js` + fallback empresa. |
| **`<category>`** | `hotel` si `configuracion.tipoNegocio === hotel`; si no, **`vacation_rental`** (cabins / complejos). No se deja vacío. |
| **`<Latitude>` / `<Longitude>`** | Obligatorios para entrar al feed; fallback empresa ubicación si complejo/hotel (`extractLatLng`). Valores numéricos con **punto decimal** (no coma). Sin geo → la propiedad se **excluye** (`skipped` / health). |
| **`<Photo>`** | Opcional: primera foto desde `metadata.linkFotos`. |
| **`<DeepLink>`** | URL absoluta al checkout SSR base del tenant + `/propiedad/<uuid>` (`buildPublicBookingBaseUrl`). |
| **`<Phone>` / `<Website>`** | Se emiten **si** hay datos: teléfono = `websiteSettings.contact.telefonoPrincipal` → `general.whatsapp` → `configuracion.telefono`; sitio = **origen público** mismo que deep link base (`buildPublicBookingBaseUrl`). Orden en XML: tras coordenadas, antes de `<Photo>`. |

### 8.2 ARI (`/feeds/google/ari.xml`)

| Pregunta típica | Comportamiento SuiteManager |
|------------------|------------------------------|
| **`<Transaction>`** | Raíz con `timestamp` e **`id` único por generación** del XML (no reutilizar el mismo id en cada deploy). Dentro: `<Result>` y por propiedad `<Property>` → `<RoomData>`. El ejemplo LLM con `<Nights>`/`<Property>` como texto plano **no** es el formato de este ARI: aquí van **`Inventory` / `Rate`** con `CheckIn`/`CheckOut`. |
| **`<Rate>` + `<Baserate>`** | Precio por segmentos de fechas; **`currency`** (p. ej. CLP) y, en modo partner Google, **`all_inclusive="true"`** cuando `partnerAllInclusive` — modelo **precio final** (estrategia B, `venta-ia.md` §7.9). Si las tarifas en BD fueran **netas** y se definiera `GOOGLE_PARTNER_ARI_NET_RATES=1`, el código **multiplica por 1.19** solo para CLP en `roundBaserateAmount`; por defecto no. |
| **`CheckIn` / `Nights`** | No hay etiqueta **`<Nights>`**. Disponibilidad y tarifa usan atributos **`CheckIn`** y **`CheckOut`** (fecha fin exclusiva tipo hotel: día siguiente al último día del segmento) en `<Inventory>` y `<Rate>` — ventana **día a día** agrupada en segmentos contiguos con mismo inventario o mismo precio. |
| **IVA / Tax** | Precio publicado en **`Baserate`** con **`all_inclusive="true"`** en modo partner Google (precio mostrado al huésped, sin sumar `<Tax>` aparte). |

**HTTP:** rutas partner y feeds tenant devuelven **`Content-Type: application/xml; charset=utf-8`**.

### 8.3 Enlaces para compartir con Gemini (feeds partner en producción)

Sustituir el host si usáis otro (`feeds.suitemanagers.com` o el que tengáis en `GOOGLE_PARTNER_EXTRA_HOSTS`) y el token del secret **`GOOGLE_PARTNER_FEED_AUTH_TOKEN`** (en la query va como `auth`, no confundir con tokens `token=` de rutas por tenant):

- **Hotel List:** `https://feeds.suitemanagers.com/feeds/google/properties.xml?auth=<TOKEN_PARTNER>`
- **ARI:** `https://feeds.suitemanagers.com/feeds/google/ari.xml?auth=<TOKEN_PARTNER>`

---

*Última actualización: 2026-05-04 — §8 address/category/Transaction id/Content-Type; ARI tax-inclusive.*
