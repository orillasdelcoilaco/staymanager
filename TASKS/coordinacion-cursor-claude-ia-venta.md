# Coordinación Cursor ↔ Claude Code (Antigravity) — IA de venta

**Propósito:** un solo lugar donde ambos lados dejan **qué están haciendo**, **qué tocar con cuidado** y **qué necesita el otro**. Reduce pisadas entre mejoras de producto (Cursor) y evolución del flujo comercial por agentes (Claude Code / ChatGPT, prompts, OpenAPI, pruebas de venta).

**Documentos relacionados:** `SHARED_CONTEXT.md`, `CLAUDE.md`, `TASKS/backlog-producto-pendientes.md`, **`TASKS/tema/SM-venta-ia/venta-ia.md`** (roadmap unificado venta IA + canales externos; el backlog **§5.3** enlaza allí el detalle), `TASKS/coordinacion-cursor-paralelo.md` (multi-agente: release 1.0.0 vs §5), `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md`, `TASKS/tema/SM-operacion-agentes/REVISION_COLABORADOR.md` (flujo general colaborador).

---

## 0. Modelo en dos dimensiones (quién usa qué)

| Dimensión | Dirección | Contenido |
|-------------|-----------|-----------|
| **A — Impacto en IA de venta** | **Cursor → Claude Code** | Cursor anuncia en este archivo (§2, §3, §4.1, §6) dónde toca código o contratos que afectan al agente (precios, `publicAiController`, OpenAPI, checkout alineado a IA, etc.). Claude Code lee esto para anticipar regresiones o reprobar flujos. |
| **B — Señal hacia implementación** | **Claude Code → Cursor** | Claude Code deja en §5.1 / §6 síntomas, hipótesis y pedidos de cambio. **Cursor** vuelca en código lo acordado y, además, **debe** reflejar estado de producto y pendientes en `TASKS/backlog-producto-pendientes.md` (hoja de ruta principal). Este archivo **no** sustituye al backlog: solo coordina la fricción Cursor ↔ Claude en IA venta. |

**Regla explícita para Cursor (también en `.cursor/rules/40-cursor-backlog-coordinacion.mdc`):** al iniciar sesión, leer siempre `TASKS/backlog-producto-pendientes.md` y seguir actualizándolo con avances y pendientes como hasta ahora. Si hay **varios chats** trabajando release + backlog a la vez, leer además **`TASKS/coordinacion-cursor-paralelo.md`** y, al cerrar un ciclo, rellenar **§11** de este archivo. La coordinación IA es complementaria.

**Claude Code:** no está obligado por la regla `.cursor/` del repo; el usuario le indica leer este archivo y el backlog cuando haga falta contexto de producto.

**Ubicación de archivos (Cursor y Claude Code):** al crear documentación, scripts o specs, seguir **`LEER-PRIMERO.md`** (tabla *Ubicación de archivos*), **`CLAUDE.md`** (*Flujo de trabajo* → *Dónde crear archivos nuevos*) y **`SHARED_CONTEXT.md`** (cabecera). No dejar informes ni `.md` sueltos en la raíz del repo ni carpetas improvisadas; por iniciativa usar **`TASKS/tema/<SM-id>/`** según **`TASKS/tablero.md`**.

---

## 1. Reglas de uso del archivo (obligatorio para ambos)

1. **Antes de empezar una tarea** (más de ~30 min o que toque API pública / tarifas / reservas): leer **§2 Estado actual** y **§3 Zona caliente / locks**.
2. **Al tomar un tema:** escribir en **§2** una línea con fecha, actor (`Cursor` | `Claude`), estado `EN CURSO`, y archivos o área.
3. **Al cerrar o pausar:** cambiar a `LISTO` o `PAUSA` y añadir **una línea** en **§6 Bitácora** (qué quedó hecho, qué vigilar).
4. **Si hay conflicto** (mismo archivo o misma ruta HTTP): quien llegó segundo **no** sobrescribe; deja nota en **§8 Bloqueos / decisiones pendientes** y alinea con el usuario.
5. **No** pegar secretos ni `.env`; solo rutas, nombres de archivos y comportamiento.

---

## 2. Estado actual — quién hace qué

_Actualizar al iniciar y al terminar trabajo relevante._

| Fecha (ISO) | Actor  | Área                             | Estado   | Nota breve (archivos / endpoint) |
|-------------|--------|----------------------------------|----------|----------------------------------|
| 2026-04-24  | Cursor | Detalle IA `precio_estimado` con fechas | LISTO | `publicAiPrecioEstimadoService.js`, `suitemanagerApiController.detalle`, OpenAPI 1.4.0. |
| 2026-04-24  | Cursor | Contexto comercial persistido + geocode al guardar | LISTO | `propiedadesMetadataPipeline.js`, `propiedadesService.js`, modal `alojamientos.modals.*`, `publicAiMarketingLayer` merge persistido/heurística. |
| 2026-04-24  | Cursor | Payload comercial IA (listado/detalle) | LISTO | `publicAiMarketingLayer.js`, `publicAiProductSnapshot.js`, `suitemanagerApiController` (galería `espacio`). Sin cambio de rutas HTTP. |
| 2026-04-24  | Cursor | Identificadores vs nombres (PG)  | Fase1 LISTO | Columna `reservas.estado_gestion_id` + código dual (nombre sincronizado). Migración: `backend/db/migrations/reservas-estado-gestion-id.sql`. SPA gestión/reservas/calendario alineados parcialmente — ver `TASKS/tema/SM-ids-vs-names/audit-identificadores-vs-nombres-ui.md` § avance. **Siguiente:** ejecutar SQL en Supabase; fase 2 canal/plantilla IA, `reservas.estado` principal, jobs SQL. |
| 2026-04-24  | Claude | `consultarDisponibilidad` / bug  | LISTO    | Fix: `resolveEmpresaPgId` + `unavailableProperties`; commit `e27f151` |
| 2026-04-24  | Claude | Estrategia multi-canal IA venta  | PAUSA | 2026-04-29: carril **§5.3 canales de venta** pasa a **solo Cursor** (backlog + chat Agent dedicado); §9 sigue como referencia técnica. Historial: roadmap §9. |
| 2026-04-24  | Cursor | `GET /api/disponibilidad` enriquecida + vibe búsqueda + confirmación reserva | LISTO | `publicAiDisponibilidadService.js`, `evaluarRestriccionesReservaWebCodigo`, `suitemanagerApiController`, OpenAPI; `requiere_confirmacion_final` en detalle; validación email/tel `publicAiController`. |
| 2026-04-25  | Cursor | Backlog producto (`TASKS/backlog-producto-pendientes.md`) | LISTO | Mapa de calor §4 + QA E2E pendiente; **actualización adicional:** §1.1f bandeja, §1.6c i18n SSR, §4 checklist Google §9 + script verify, §6 referencias, pie. |
| 2026-04-25  | Cursor | Release 1.0.0 — `test:ci` + plan + CI workflow | LISTO | `package.json` `test:ci` ampliado (smoke §2 scripts); `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md` §2.1; `backend/scripts/test-integrations-settings-sanitize.js`; `.github/workflows/ci-smoke.yml` → `npm run test:ci`. Smoke manual §2.3 y push tag `v1.0.0` pendientes operación/staging. |
| 2026-04-29  | Cursor | §5.3 canales de venta — solo Cursor (estrategia + repo) | LISTO | Backlog §5.3 + regla `45-canales-venta-solo-cursor.mdc`; chat Agent dedicado; fila Claude multi-canal → **PAUSA**; §9 responsables actualizados para trabajo nuevo. |
| 2026-05-01  | Cursor | Roadmap venta IA unificado en `TASKS/tema/SM-venta-ia/venta-ia.md` | LISTO | Nuevo archivo único: checklist + análisis construido vs pendiente + enlaces TASKS; backlog §5.3 acortado con enlace; `LEER-PRIMERO.md` + doc multi-agente (`coordinacion-cursor-paralelo.md`, antes `leer-primero.md`) orden de lectura. |
| 2026-05-01  | Cursor | **Canales IA** — checklist Google §0 automático + aviso sin host | LISTO | `canalesIa.checklistGoogleS0.js` + `canalesIa.js`; `venta-ia.md` §2.6, `qa-y-seguimiento` §1.2, backlog; `npm run test:ci` verde. |
| 2026-05-01  | Cursor | Panel SPA **Canales IA** (`/canales-ia`) — Google Hotels / feeds / tabla alojamientos | LISTO | `canalesIa.js`, `router.js`, `webPublica.general.unified.*`, `alojamientos.modals.*`; doc §2.6 `venta-ia.md`, backlog §5.3/§6, checklist Google, LEER-PRIMERO paso 4; sin cambio rutas API agente. |
| 2026-05-02  | Cursor | Partner global **`googleHotelsGlobalService.js`** + health `partnerGlobalFeed` + smoke HTTP | LISTO | Feeds `/feeds/google/*.xml` IDs BD, ARI alineado `partnerXmlIdsFromDatabase`, sin cambio rutas OpenAPI agente; doc backlog + checklist deploy + `venta-ia.md` §6. |
| 2026-05-03  | Cursor | Canales IA — UI operación partner + plan §8 superadmin/operadores | LISTO | `partnerFeedsSelftest.js`, `GET/POST /website/google-partner-feed-*`, `canalesIa.googlePartner.operator.js`; `venta-ia.md` §8 + backlog; sin cambio OpenAPI/agente. |
| 2026-05-03  | Cursor | Backlog §5.x **A** heatmap QA + **C** comparador cierre | LISTO | `npm run test:ci` verde (heatmap + restricciones web + booking sanitize + `test-comparador-ota-service.js`); `TASKS/tema/SM-heatmap-qa/qa-heatmap-restricciones-e2e.md` §12; backlog §5.x **A**/**C**; **B** sigue otro agente. |

**Convención de estados:** `EN CURSO` | `LISTO` | `PAUSA` | `BLOQUEADO`.

---

## 3. Zona caliente — coordinar antes de cambiar en paralelo

Estas piezas afectan **directamente** lo que ve ChatGPT / acciones OpenAPI y lo que calcula el sitio público. Si Cursor va a tocarlas, avisar aquí; si Claude Code ajusta contrato o flujo, avisar igual.

| Tema | Archivos / rutas típicas | Riesgo si no se coordina |
|------|---------------------------|---------------------------|
| Precio reserva / tarifas | `calculoValoresService.js`, `tarifasService.js` (`obtenerTarifasParaConsumidores`), `website.shared.js` (`fetchTarifasYCanal`), `publicWebsiteService.js` | Totales distintos IA vs checkout; promos `metadata.promo` desalineadas |
| Reserva pública IA | `publicAiController.js` (`createPublicReservation`, `quotePriceForDates`, `createBookingIntent`) | 422/409, montos incorrectos, doble canal (`IA Reserva` vs default). **2026-04-24:** al tocar este archivo, alinear con regla *id/semántica, no nombre de canal/plantilla* (`SHARED_CONTEXT.md`, `TASKS/tema/SM-ids-vs-names/audit-identificadores-vs-nombres-ui.md`) |
| OpenAPI / GPT | `backend/openapi/openapi-chatgpt.yaml`, `suitemanagerApiController.js`, `publicRoutes.js` | El agente llama endpoints rotos o con body distinto |
| Checkout web SSR | `website.booking.js`, `reservar.ejs`, `public/js/checkout.js`, `crearReservaPublica`, reconciliación precio, aceptación términos | Regresiones en reserva humana al “alinear” IA |
| Feeds Google Hotels **globales** (connectivity partner) | Nuevo módulo **solo host plataforma** (`TASKS/tema/SM-venta-ia/venta-ia.md` §7); **no** mezclar con `website.seo.js` tenant | Precios en XML ≠ checkout tenant; roturas en verificación Google / Price Accuracy |

**Locks explícitos (opcional):** si necesitas exclusividad temporal, añade:

```
LOCK hasta YYYY-MM-DD — Actor — área — motivo
```

Quitar el lock cuando termines.

---

## 4. Procedimiento — Cursor (implementación en repo)

1. Leer **`TASKS/backlog-producto-pendientes.md`** (obligatorio: hoja de ruta y contexto). Luego **§2** y **§3** de este archivo si el trabajo toca o puede tocar IA venta.
2. Si la tarea toca la tabla de §3: añadir fila `EN CURSO` en §2 con paths concretos.
3. Implementar con alcance mínimo; respetar `CLAUDE.md` (SPA/SSR, tenant, `valorHuesped`).
4. Al terminar: **actualizar el backlog** (`backlog-producto-pendientes.md`) con hitos, pendientes al retomar y referencias de código, como se viene haciendo.
5. Cerrar en este archivo: §2 a `LISTO`, línea en **§6**; si afecta IA de venta, **§4.1 Handoff a Claude Code**. Si tocaste precios/reserva IA: indicar reprobación sugerida de `POST /api/public/reservas` y cotización asociada.

### 4.1 Handoff Cursor → Claude Code (copiar y rellenar)

```
## Handoff Cursor → Claude (fecha ISO)
- Cambios resumidos en una frase:
- Archivos / rutas HTTP:
- Comportamiento esperado para el agente / GPT:
- Pruebas sugeridas (curl o pasos):
- Riesgos / pendiente consciente:
```

**Handoff (Cursor — 2026-05-02) — Connectivity Partner feeds globales (sin cambio API agente / OpenAPI):**

- Cambios resumidos: servicio **`googleHotelsGlobalService.js`** centraliza XML agregado; **`generateAriFeed`** acepta `partnerXmlIdsFromDatabase` + `restrictToPropertyIds` (paridad IDs con Property List); health **`partnerGlobalFeed`**; errores 500 feeds con detalle XSD/XML; script smoke HTTP **`smoke-google-partner-feeds-http.js`**.
- Archivos / rutas HTTP: `GET /feeds/google/properties.xml`, `GET /feeds/google/ari.xml` (auth query `?auth=`), host `feeds.` / `api.` / `GOOGLE_PARTNER_EXTRA_HOSTS`; `googleHotelsHealthService.evaluateGoogleHotelsHealth` incluye elegibilidad partner global.
- Comportamiento esperado para el agente / GPT: **sin cambio** en Actions/OpenAPI; precios/checkout usuario siguen en rutas ya documentadas.
- Pruebas sugeridas: tras deploy, `GH_PARTNER_FEED_BASE_URL` + `GH_PARTNER_FEED_AUTH_TOKEN` → `node backend/scripts/smoke-google-partner-feeds-http.js`; panel Canales IA → health JSON con `partnerGlobalFeed`.
- Riesgos / pendiente: **DNS** `feeds.`/`api.` + env Render en prod; **Place ID** para modo estricto (`GOOGLE_PARTNER_REQUIRE_PLACE_ID=1`); trámite Google externo.

**Último handoff (Cursor — 2026-05-01) — Canales IA SPA (solo producto/panel, sin cambio de contrato API agente):**

- Cambios resumidos: unificación en panel **Operaciones → Canales IA** (`/canales-ia`) de tokens feeds ARI/Google Hotels content, semáforo Google Hotels, tabla por alojamiento (`hotelId`, listado); Configurar sitio web con puente y preservación de tokens al guardar; modal alojamientos con CTA hacia Canales IA.
- Archivos / rutas HTTP: `frontend/src/views/canalesIa.js`, `frontend/src/router.js`; `webPublica.general.unified.{js,markup.js,handlers.js}`; `alojamientos.modals.{js,render.js}`; mismos endpoints `PUT /website/home-settings` (`integrations`), `GET /website/google-hotels-health`, `PUT /propiedades/:id` (`googleHotelData`).
- Comportamiento esperado para el agente / GPT: **sin cambio** en rutas públicas IA; feeds XML y JSON-LD siguen igual en servidor.
- Pruebas sugeridas: navegar SPA a `/canales-ia`, guardar tokens y una fila alojamiento; guardar Configurar sitio web sin borrar tokens.
- Riesgos / pendiente: política mascotas ChatGPT sigue en formulario unificado **Configuración Web** (merge parcial `booking` en `home-settings`); pestaña ChatGPT en Canales IA solo enlaza.

**Actualización handoff (Cursor — 2026-05-01) — §0 checklist Google en panel (sin cambio API agente):**

- Cambios resumidos: bloque **Checklist Google — §0 automático** en pestaña Google Hotels (`buildPublicBaseUrl`, texto desde `/empresa` + `/auth/me`, copiar portapapeles, banner si sin dominio/subdominio + navegación a `/website-general`).
- Archivos: `frontend/src/views/canalesIa.js`, `frontend/src/views/components/canalesIa/canalesIa.checklistGoogleS0.js`; rutas HTTP solo lectura existentes (`GET /api/empresa`, `GET /api/auth/me`).
- Agente / GPT: sin cambio en contratos públicos.
- Pruebas: abrir `/canales-ia` → Google Hotels → ver §0 y Copiar; tenant sin host → banner advertencia.

---

## 5. Procedimiento — Claude Code (Antigravity — IA venta)

1. Leer **§2**, **§3** y últimas entradas de **§6**. Para contexto de producto global, el usuario puede pedirte también `TASKS/backlog-producto-pendientes.md` (Cursor lo mantiene como verdad operativa de roadmap).
2. Si vas a proponer cambios de código en zonas §3: crear fila `EN CURSO` en §2 o pedir lock al usuario.
3. Documentar en **§6** hallazgos de producto (fricción del agente, errores API, copy del manifiesto) **sin** asumir que ya están en código hasta que Cursor o tú lo mergeen.
4. Al cerrar un sprint de IA: completar **§5.1 Handoff a Cursor** si hay bug confirmado o cambio de contrato deseado. Cursor incorporará cambios de código y **reflejará** en el backlog lo que cierre hito de producto.

### 5.1 Handoff Claude Code → Cursor (copiar y rellenar)

```
## Handoff Claude → Cursor (fecha ISO)
- Síntoma o objetivo de producto:
- Pasos para reproducir (incl. empresa/propiedad si aplica):
- Respuesta HTTP / logs (sin datos personales):
- Hipótesis técnica (archivo sospechoso si la hay):
- ¿Cambio de OpenAPI o solo backend?
```

---

## 6. Bitácora corta (más reciente arriba)

_Formato: `YYYY-MM-DD — Actor — una frase`._

- 2026-05-05 — Claude Code — **SM-recontacto-sin-disponibilidad → Listo**: migración `espera-disponibilidad.sql` (UUID→TEXT fix) en prod; deploy Render; smoke A/B/C ✅ vía API pública; fix bonus `canalesService` (`IA_VENTA_CANAL_ORIGEN`, `resolverCanalIaVentaEnLista` faltaban). ChatGPT reimport 1.4.8 y panel D/E pendientes manual.
- 2026-05-06 — Cursor — Tablero: **`SM-ghc-onboarding` → Listo** (partner directo cerrado comercialmente); **`venta-ia.md` §7.0** congelación ampliación código partner; tema nuevo **`SM-beds24`** (`plan-accion-beds24.md`, `beds24-integracion-inicio.md`); backlog §5.x **B/E** alineados.
- 2026-05-05 — Cursor — OpenAPI ChatGPT/Gemini **1.4.8**: `ListaEsperaEnRespuesta`, `ErrorWaitlistEmailRequired`, `POST /api/public/reservar/intent`, `POST /api/public/reservas`, **409/422** + **`lista_espera`** en `POST /api/reservas`; `PUBLIC_API_CONTRACT_VERSION` default **1.4.8**.
- 2026-05-05 — Cursor — **Lista de espera (sin disponibilidad) alineada a IA:** `publicAiController` (`createBookingIntent`, `createPublicReservation`) llama `registrarEsperaDisponibilidadDesdeIa` en `esperaDisponibilidadService.js` (misma tabla + correo + reconciliación que el panel); eliminado `noAvailabilityFollowupService.js`. Si hay bloqueo y falta email en `createBookingIntent` → **400** `WAITLIST_EMAIL_REQUIRED`. Respuestas **409/422** pueden incluir **`lista_espera`** (`registrado`, `duplicado`, o `code`/`message`). Consentimiento IA implícito en BD (`consentimiento_implicito_ia` en metadata).
- 2026-05-04 — Cursor — Google **rechaza** nuevos connectivity partners **directos** (correo gTech); estrategia **pausa trámite directo**, **mantiene** código feeds/catálogo partner; doc **`TASKS/tema/SM-gh-strategy-cm/google-hotels-estrategia-post-partner-google.md`** + **`venta-ia.md` §7.0** + backlog §5.3; próxima vía probable **CM** (ej. Beds24, coste a validar).
- 2026-05-03 — Cursor — Backlog **§5.x A** (heatmap) y **§5.x C** (comparador): cierre documental + criterio técnico (`npm run test:ci` verde, `TASKS/tema/SM-heatmap-qa/qa-heatmap-restricciones-e2e.md` §12, `venta-ia.md` §5.1 fila 4 + §5.2 nota); **§5.x B** lo lleva otro agente.
- 2026-05-03 — Cursor — Marketplace UI: paridad **`/`** ↔ **`/google-hotels`**, partials estilos/pie, JSON-LD catálogo (`ItemList`/`BreadcrumbList`), `precioDesdeToSchemaPriceRange` en home ItemList; enlaces legales `/legal/*`. Sin cambio rutas API agente ni feeds XML.
- 2026-05-03 — Cursor — Nuevo **`TASKS/tema/SM-auditoria-calidad/solo-ui.md`**: trabajo **solo UI** marketplace `suitemanagers.com` (EJS + strings), límites con **`venta-ia.md`** / §3; sin cambio OpenAPI ni feeds.
- 2026-05-03 — Cursor — Canales IA → Google Hotels: bloque **operación plataforma** (URLs sin token + botón selftest HTTP vía `partnerFeedsSelftest.js` + rutas `google-partner-feed-operator` / `google-partner-feed-selftest`). Plan **superadmin + operadores** en **`TASKS/tema/SM-venta-ia/venta-ia.md` §8** (implementación post–Google; endpoints hoy abiertos a cualquier admin JWT — restringir en fase plataforma). Sin cambio contrato agente/OpenAPI.
- 2026-05-02 — Cursor — Agregador **`backend/services/googleHotelsGlobalService.js`** (§7.9–§7.10): Property List + ARI global, IDs `propiedades.id`, filtros geo/Place ID, `auditPartnerListingGapsForEmpresa` → health **`partnerGlobalFeed`**; script **`backend/scripts/smoke-google-partner-feeds-http.js`**; backlog + **`google-hotels-partner-deploy-checklist.md`** + **`venta-ia.md`** §6. Sin cambio contrato ChatGPT/OpenAPI ni `publicAiController`.
- 2026-05-02 — Cursor — Partner cierre ciclo: **`TASKS/tema/SM-ghc-onboarding/google-hotels-partner-deploy-checklist.md`**; backlog §5.x **B** + §5.3; ficha **`/propiedad/:id`** requiere solo **activo** (`publicWebsiteService.obtenerPropiedadPorId` expone `activo`; `website.property.page.js`). Partner stack previo: feeds, `/google-hotels`, §7.11 SSR, **`venta-ia.md`**.
- 2026-05-01 — Cursor — Menú SPA **Fase 1**: **Inventario** + **Sitio público** (sin tocar Flujo de Trabajo); **`TASKS/tema/SM-spa-menu/plan-reorganizacion-menu-spa.md`**.
- 2026-05-01 — Cursor — SPA **Operaciones → Canales IA**: checklist Google **§0 automático** (pre + Copiar + banner sin URL pública); `canalesIa.checklistGoogleS0.js`; doc **`venta-ia.md` §2.6**, **`qa-y-seguimiento-prelaunch-canales.md`** §1.2, backlog contexto; handoff §4.1 actualizado; sin cambio OpenAPI/API agente.
- 2026-05-01 — Cursor — SPA **Operaciones → Canales IA** (`/canales-ia`): tokens feeds + semáforo Google Hotels + tabla `hotelId`/listado por alojamiento; puente desde Configurar sitio web; modal alojamientos → CTA; doc **`TASKS/tema/SM-venta-ia/venta-ia.md` §2.6**, backlog §5.3/§6, checklist Google, **`LEER-PRIMERO.md`** paso 4; handoff §4.1 rellenado.
- 2026-05-02 — Cursor — OpenAPI ChatGPT/Gemini **1.4.7**: documentado **GET `/api/public/version`**; contrato en **`backend/openapi/`** (fuente única); comparador §4.3 D DoD en **`TASKS/tema/SM-venta-ia/venta-ia.md` §5.2**.
- 2026-05-02 — Cursor — **Venta IA:** sin OTAs de terceros como **canal de venta**; aclarado que iCal/reportes/sync de reservas (operación PMS) no se elimina — distinto de vender vía OTA. Documentos alineados.
- 2026-05-01 — Cursor — **`TASKS/tema/SM-venta-ia/venta-ia.md`:** consolida roadmap canales IA (antes §5.3 largo en backlog), checklist unificado, gaps; backlog §5.3 enlaza; lectura obligatoria en `LEER-PRIMERO.md` si toca venta IA.
- 2026-04-29 — Cursor — **§5.3 solo Cursor:** objetivos por canal en backlog, jugada API+MCP+JSON-LD+SSR, checklist §5.x **F**; chat Agent dedicado + regla **`45-canales-venta-solo-cursor.mdc`**; fila Claude multi-canal → **PAUSA**; §9 alineado.
- 2026-04-25 — Cursor — **Release 1.0.0 (puerta técnica):** `npm run test:ci` ampliado (`package.json`) con tests alineados a smoke plan §2.1; `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md` actualizado; `ci-smoke.yml` ejecuta `test:ci`; script `test-integrations-settings-sanitize.js`. Pendiente: smoke manual §2.3 staging + tag `v1.0.0` + push integrador.
- 2026-04-25 — Cursor — Checklist Google Hotels §9 + script `verify-google-hotels-feed-checklist.js`; SSR `htmlLang` en `website.context.js` + i18n home/contacto/404/header/footer/confirmación/property-card; UX bandeja `comunicaciones.js` (error carga, vacíos, toasts reintento); comentarios multi-tenant calendario/feed.
- 2026-04-25 — Cursor — Backlog de producto actualizado: §4 “Mapa de calor / restricciones” y §4.3 D reflejan cierre funcional (edición panel, overlay calendario, min noches por llegada en backend + widget), quedando QA E2E como pendiente.
- 2026-04-24 — Cursor — OpenAPI **1.4.4:** disponibilidad documenta `endpoints` + `requiere_confirmacion_reserva`.
- 2026-04-24 — Cursor — `GET /api/alojamientos/detalle` incluye **booking_workflow** (`buildBookingWorkflowForIaDetallePg` en `publicAiProductSnapshot.js`); OpenAPI **1.4.3**; disponibilidad IA `endpoints.cotizar_reserva_dry_run`.
- 2026-04-24 — Cursor — §9 **1C** actualizado (cotizar precio / dry-run entregado); `booking_workflow` en `getPropertyDetail` con **paso_2b** + `paso_2b_body` (POST `/api/public/reservas/cotizar`).
- 2026-04-24 — Cursor — OpenAPI **1.4.2:** path explícito `POST /api/public/reservas/cotizar` (cabeceras agente) además de `/api/reservas/cotizar` (ChatGPT + Gemini YAML).
- 2026-04-24 — Cursor — Cotización dry-run reserva IA: `POST /api/reservas/cotizar` + `POST /api/public/reservas/cotizar` (`publicAiReservaCotizacionService.js`); `sugerencia_previa` en 201 de `createPublicReservation`.
- 2026-04-24 — Cursor — Disponibilidad IA v1: fotos PG preview, precio total estadía por alojamiento libre, códigos restricción/motivo no disponible, `is_demo_heuristica`; búsqueda `vibe`; detalle `requiere_confirmacion_final`; POST reserva valida email/tel.
- 2026-04-24 — Cursor — Reseña outbound: `[LINK_RESEÑA]` en confirmación de reserva y recordatorio pre-llegada (`resolverLinkResenaOutbound` en `transactionalEmailService.js`).
- 2026-04-24 — Cursor — Retención PII identidad check-in web documentada en `SHARED_CONTEXT.md` §2.2 y apunte en `CLAUDE.md` (job `npm run job:retencion-checkin-identidad-pii`, flags `websiteSettings.booking`).
- 2026-04-24 — Cursor — `GET /api/alojamientos/detalle?checkin&checkout` (+aliases) devuelve `precio_estimado` (`publicAiPrecioEstimadoService.js`: misma `calculatePrice` que web SSR + `buildDesglosePrecioCheckout`). OpenAPI 1.4.0.
- 2026-04-24 — Cursor — Persistencia `metadata.contextoComercial` (tipo_viaje, entorno, destacados) + UI modal alojamiento; IA usa persistido y heurística solo si vacío. Geocoding Nominatim al guardar propiedad (`propiedadesMetadataPipeline.js` + `propiedadesService` merge metadata completo + `googleHotelData.geo`).
- 2026-04-24 — Cursor — Snapshot IA: `publicAiMarketingLayer.js` + integración en `publicAiProductSnapshot.js` (`contexto_turistico`, `amenidades_publicas`, `inventario_detallado`, `descripcion_fuente` + texto auto si falta descripción, `enrichUbicacionForAi`). Galería: `espacio`, `tipo_ia`, `principal` por `rol` en detalle y `imagenes`. Revisar OpenAPI si documentan nuevos campos.
- 2026-04-24 — Claude — Estrategia multi-canal definida en §9; roadmap por tier; handoff JSON-LD a Cursor.
- 2026-04-24 — Claude — Fix `consultarDisponibilidad`: `resolveEmpresaPgId` + `unavailableProperties` devuelto en `_buildAvailabilityResult`; push a Render.
- 2026-04-24 — Cursor — Creado este documento y plantillas de handoff; pendiente primera fila real en §2.
- 2026-04-24 — Cursor — **§11** coordinación cierre 1.0.0 + agente B: enlaces `coordinacion-cursor-paralelo.md` / `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md`; primera fila estado gate CI + pendientes smoke/tag (ver §11.2).

---

## 7. Referencia rápida — superficie IA venta

| Qué | Dónde |
|-----|--------|
| Crear reserva desde agente | `POST /api/public/reservas` o `POST /api/reservas` → `publicAiController.createPublicReservation` |
| Cotizar reserva (dry-run) | `POST /api/reservas/cotizar` o `POST /api/public/reservas/cotizar` → `publicAiReservaCotizacionService.cotizarReservaIaPublica`; OpenAPI **1.4.4** |
| OpenAPI ChatGPT | `backend/openapi/openapi-chatgpt.yaml` |
| Motor de precio compartido (panel / propuestas / muchas rutas) | `services/utils/calculoValoresService.js` |
| Precio checkout SSR + reconciliación | `publicWebsiteService.js` |
| Backlog producto (tarifas, §4 checkout) | `TASKS/backlog-producto-pendientes.md` |
| Roadmap venta IA + canales externos | `TASKS/tema/SM-venta-ia/venta-ia.md` |
| Panel usuario Canales IA (Google Hotels / feeds) | **`TASKS/tema/SM-venta-ia/venta-ia.md` §2.6**; SPA `frontend/src/views/canalesIa.js`, `frontend/src/router.js` |

---

## 8. Bloqueos / decisiones pendientes

| Fecha      | Quién  | Tema                                              | Estado    |
|------------|--------|---------------------------------------------------|-----------|
| 2026-04-24 | Claude | `empresa_id` en propiedades usa Firestore doc ID vs slug en otras tablas — mapeado con `resolveEmpresaPgId` como workaround. Validar si propiedades debe migrar su campo o se mantiene el resolver. | Abierto |
| 2026-04-24 | Claude | ¿Se aprueba construir MCP Server en `backend/mcp/`? Necesita agregar `@modelcontextprotocol/sdk` a `package.json`. Decisión del usuario. | Pendiente usuario |

---

## 9. Estrategia multi-canal IA venta — hoja de ruta

**Implementación activa del carril §5.3 (canales externos / MCP / OpenAPI): solo Cursor** — un chat de Agent dedicado + regla opcional `.cursor/rules/45-canales-venta-solo-cursor.mdc`. La columna «Responsable» en la tabla inferior es histórica; para trabajo nuevo en §5.3 usar **Cursor** (la fila §2 *Estrategia multi-canal* en modo Claude quedó en **PAUSA**).

_Actualizado: 2026-04-24 (tabla); roadmap canales **2026-05-01** consolidado en **`TASKS/tema/SM-venta-ia/venta-ia.md`** (antes detalle largo en backlog §5.3)._

### Mapa de canales y protocolo técnico

| Canal / Plataforma | Protocolo / Standard | Tier | Responsable |
|--------------------|----------------------|------|-------------|
| **ChatGPT** (Actions/GPT) | OpenAPI 3.1 (`openapi-chatgpt.yaml`) | ✅ Activo | Cursor (refinamiento contrato) |
| **Claude** (Desktop, IDE, API) | **MCP Server** (`@modelcontextprotocol/sdk`) | 🔴 P1 | Cursor (§5.3; regla `45-canales-venta-solo-cursor.mdc`) |
| **Perplexity / buscadores IA** | `llms.txt` + sitemap XML | 🔴 P1 | Cursor |
| **Google AI Overview (SGE)** | JSON-LD mejorado (LodgingBusiness, BookAction, FAQ) | 🔴 P1 | Cursor |
| **Gemini** (Google AI Studio) | OpenAPI (`openapi-gemini.yaml`) — mismo backend | 🟡 P2 | Cursor |
| **WhatsApp Business** | Meta Business API webhook → `publicAiController` | 🟡 P2 | Cursor |
| **Google Hotels** | ARI XML feed (OTA-connect) — `googleHotelsService.js` | 🟡 P2 | Cursor |
| **Bing / Microsoft Copilot** | Plugin OpenAPI + Bing Webmaster | 🟠 P3 | Cursor |
| **Instagram / Facebook DM** | Meta Business API (Messenger Platform) | 🟠 P3 | Cursor |
| **Alexa / Google Assistant** | Voice intents / Smart Home API | 🔵 P4 | futuro |

---

### Tier 1 — Implementación inmediata (Cursor)

#### 1A. MCP Server (clientes MCP, p. ej. Claude Desktop)
**Qué:** servidor MCP (`Model Context Protocol`, standard Anthropic) que expone las herramientas de reserva. Cualquier usuario de Claude Desktop, Claude.ai con MCP, o agente que use el SDK de Anthropic puede buscar cabañas y reservar sin salir de Claude.

**Cómo:** `backend/mcp/staymanager-mcp-server.js` con transporte `stdio`. Herramientas: `buscar_propiedades`, `consultar_disponibilidad`, `cotizar_precio`, `crear_reserva`, `obtener_detalle`. Sirve el mismo backend que ChatGPT — sin duplicar lógica.

**Archivo de configuración para el usuario final** (`mcp-config.json`): describe cómo agregar SuiteManager a Claude Desktop.

**Decisión pendiente:** aprobación de Pablo para agregar `@modelcontextprotocol/sdk` al `package.json`.

#### 1B. `llms.txt` por tenant
**Qué:** archivo estático en `/llms.txt` (y `/llms-full.txt`) servido por el SSR de cada empresa. Perplexity, Claude con búsqueda web, SearchGPT, Brave AI lo leen para entender qué ofrece el sitio.

**Contenido:** nombre empresa, descripción, propiedades listadas (nombre, capacidad, precio desde), instrucción de booking ("Para reservar, usar `POST https://suite-manager.onrender.com/api/reservas`"), contacto.

**Quién lo implementa:** Cursor — ruta nueva en `website.home.js` o `website.js`, generada dinámicamente desde la BD.

#### 1C. Cotizar precio / dry-run antes de reservar (OpenAPI + API)
**Estado:** **Entregado (2026-04-24, Cursor).** No hace falta `GET /api/cotizar` global.

- **Precio rápido por propiedad:** `GET /api/public/propiedades/:id/cotizar?fechaInicio=&fechaFin=` (ya existía).
- **Dry-run alineado a checkout y política (sin persistir):** `POST /api/reservas/cotizar` y `POST /api/public/reservas/cotizar` → `publicAiReservaCotizacionService.cotizarReservaIaPublica`; OpenAPI ChatGPT/Gemini **1.4.2** documenta ambos paths.

**Pendiente de producto (opcional):** si se quiere un único alias tipo `GET /api/cotizar` por ergonomía de Actions, valorar; hoy los contratos YAML son la fuente.

---

### Tier 2 — Sprint siguiente (Cursor; coordinar §3 si API/checkout)

#### 2A. WhatsApp Business API
- Webhook `POST /api/webhook/whatsapp` recibe mensajes → router de intenciones (disponibilidad, reserva, precio)
- Misma lógica que `publicAiController` pero entrada/salida por texto WhatsApp
- Cursor necesita agregar número y credenciales en configuración empresa

#### 2B. Google Hotels ARI Feed completo
- `googleHotelsService.js` ya tiene estructura XML parcial
- Completar el feed ARI (disponibilidad + precios) y exponer en `/google-hotels-feed.xml`
- Requiere Google Hotel Center Partnership por empresa

#### 2C. JSON-LD enriquecido (Cursor)
- Agregar `BookAction`, `FAQ`, `HowTo` y `AggregateOffer` al JSON-LD existente
- Target: Google AI Overview responde "cómo reservar cabaña X" con datos de SuiteManager

---

### Handoff inicial Claude → Cursor

```
## Handoff Claude → Cursor (2026-04-24)
- Síntoma o objetivo de producto:
  Google AI Overview / SGE no muestra precios ni acción de reserva en búsquedas
  de alojamiento; falta schema.org BookAction y AggregateOffer en JSON-LD del SSR.
- Pasos para reproducir:
  Buscar "cabaña [empresa] [destino] precio" en Google → AI Overview no tiene precio
  ni CTA de reserva.
- Respuesta HTTP / logs: N/A — problema de indexación/schema.
- Hipótesis técnica:
  El JSON-LD actual (LodgingBusiness) no incluye `potentialAction` de tipo BookAction
  ni `offers` con `price`/`priceCurrency`/`availability`. Archivos:
  `backend/routes/website.property.page.js` (genera el JSON-LD de ficha),
  `backend/routes/website.home.js` (JSON-LD home).
- ¿Cambio de OpenAPI o solo backend?
  Solo backend SSR + JSON-LD. No afecta OpenAPI ni el controlador IA.
- Prioridad: P1 — impacto en Google Search + AI Overview para todos los tenants.
```

---

## 10. Varios agentes y el mismo archivo TASKS (p. ej. backlog)

**Problema:** dos sesiones (dos instancias de Cursor, o Cursor + otro agente) editan a la vez `TASKS/backlog-producto-pendientes.md` u otro markdown de `TASKS/` → merge conflictivo o trabajo duplicado.

**Protocolo (recomendado para todo agente que toque el repo vía Cursor):**

1. **Antes** de modificar `backlog-producto-pendientes.md`: leer **§2 Estado actual** de este archivo. Si hay una fila **EN CURSO** cuya columna «Área» sea el backlog (o nombre explícito del `.md`) y el actor **no** eres tú, **no** editar ese archivo; avisar al usuario o anotar en **§8 Bloqueos / decisiones pendientes**.
2. **Cuando tú** vayas a ser quien edita el backlog: añade **de inmediato** una fila en **§2** (fecha ISO, actor `Cursor` u otro identificador que acuerdes con el usuario, área `backlog-producto-pendientes.md`, estado `EN CURSO`, nota: secciones o hitos que tocarás).
3. **Al cerrar o pausar:** pasar la fila a `LISTO` o `PAUSA` y una línea en **§6 Bitácora**.
4. **Bloqueo explícito varios días:** en **§3** usar la convención **LOCK** indicando el path exacto del archivo (ej. `LOCK hasta 2026-04-26 — Cursor — TASKS/backlog-producto-pendientes.md — retomar §4 legal`).

**Otros agentes** (Claude Code, Antigravity): el usuario debe pedirles que lean **§2 / §3** aquí antes de tocar el mismo markdown.

Este archivo **no** sustituye al backlog: solo coordina **quién lo está moviendo** para que el resto espere o alinee con el usuario.

---

## 11. Release **1.0.0** — resumen conjunto (Cursor A + Cursor B)

**Cuándo usar:** al terminar (o pausar) el reparto descrito en **`TASKS/coordinacion-cursor-paralelo.md`**: Agente A = cierre 1.0.0 (`TASKS/tema/SM-rel-v100/plan-release-1.0.0.md`), Agente B = **§5 ítem 2** del backlog (preferencias/copy motor **§1.6**, salvo que el usuario redirija a otra fila §5).

**Qué hacer:** copiar la plantilla de la siguiente subsección debajo de la línea `---` del bloque vigente, rellenar, y marcar en **`TASKS/tema/SM-rel-v100/plan-release-1.0.0.md` §2** los checkboxes del smoke si aplica.

### 11.1 Plantilla (copiar desde la siguiente línea `---`)

```
### Resumen release / backlog — YYYY-MM-DD
| Ítem | Estado | Nota |
|------|--------|------|
| `npm run test:ci` (rama candidata) | SÍ / NO / N/A | rama / commit |
| `npm run test:ssr` (SSR arriba) | SÍ / NO / omitido | |
| Smoke manual plan §2 (staging) | SÍ / NO / parcial | checklist en plan-release |
| Tag `v1.0.0` aplicado | SÍ / NO | repo remoto / notas release |
| Agente B — backlog §5 ítem 2 (§1.6 u otro acordado) | LISTO / EN CURSO / N/A | archivos o PR |
| Próxima asignación sugerida | | ej. §5.3 dominio, §2.3 widget, §4.3 D |

Detalle libre (bloqueos, deploy, migraciones):
-
```

### 11.2 Entrada vigente (la más reciente arriba; seguir añadiendo bloques 11.1 encima de esta tabla)

```
### Resumen release / backlog — 2026-04-25
| Ítem | Estado | Nota |
|------|--------|------|
| `npm run test:ci` (rama candidata) | SÍ | Cadena ampliada (smoke §2 + regresión); verde local; `package.json` + `ci-smoke.yml`. |
| `npm run test:ssr` (SSR arriba) | omitido | Opcional; no bloquea puerta CI. |
| Smoke manual plan §2 (staging) | pendiente | Checklist §2.3 en `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md` + tabla §2.1. |
| Tag `v1.0.0` aplicado | SÍ (local) | Commit gate CI; push tras smoke §2.3 (`coordinacion-cursor-paralelo.md` §5.1). |
| Agente B — backlog §5 ítem 2 (§1.6) | pendiente | Otro chat según reparto. |
| Próxima asignación sugerida | | Smoke §2.3 → `git push origin v1.0.0` → §4.3 D / §5. |
```

| Ítem | Estado | Nota |
|------|--------|------|
| `npm run test:ci` (rama candidata) | SÍ | 2026-04-25: cadena ampliada + verde local (`package.json`, workflow CI). |
| `npm run test:ssr` (SSR arriba) | omitido | Opcional hasta smoke de vistas públicas. |
| Smoke manual plan §2 (staging) | pendiente | Checklist en `TASKS/tema/SM-rel-v100/plan-release-1.0.0.md` §2.3 / §2.1. |
| Tag `v1.0.0` aplicado | SÍ (local) | Anotado en commit gate CI; **push** tras smoke §2.3 + acuerdo integrador. |
| Agente B — backlog §5 ítem 2 (§1.6) | pendiente | Otro chat / agente según `coordinacion-cursor-paralelo.md`. |
| Próxima asignación sugerida | | Completar smoke §2.3 → push tag `v1.0.0`; luego §5.3 dominio, §2.3 widget, §1.4 iCal, §4.3 D según prioridad. |

---

*Última revisión: 2026-05-01 — **`TASKS/tema/SM-venta-ia/venta-ia.md`** como fuente unificada roadmap canales IA; §5.3 backlog enlaza allí. Histórico 2026-04-29: §5.3 solo Cursor; Claude → PAUSA; regla `45-canales-venta-solo-cursor.mdc`. Histórico 2026-04-25: §11, CI, §10.*
