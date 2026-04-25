# Coordinación Cursor ↔ Claude Code (Antigravity) — IA de venta

**Propósito:** un solo lugar donde ambos lados dejan **qué están haciendo**, **qué tocar con cuidado** y **qué necesita el otro**. Reduce pisadas entre mejoras de producto (Cursor) y evolución del flujo comercial por agentes (Claude Code / ChatGPT, prompts, OpenAPI, pruebas de venta).

**Documentos relacionados:** `SHARED_CONTEXT.md`, `CLAUDE.md`, `TASKS/backlog-producto-pendientes.md`, `TASKS/leer-primero.md` (multi-agente: release 1.0.0 vs §5), `TASKS/plan-release-1.0.0.md`, `REVISION_COLABORADOR.md` (flujo general colaborador).

---

## 0. Modelo en dos dimensiones (quién usa qué)

| Dimensión | Dirección | Contenido |
|-------------|-----------|-----------|
| **A — Impacto en IA de venta** | **Cursor → Claude Code** | Cursor anuncia en este archivo (§2, §3, §4.1, §6) dónde toca código o contratos que afectan al agente (precios, `publicAiController`, OpenAPI, checkout alineado a IA, etc.). Claude Code lee esto para anticipar regresiones o reprobar flujos. |
| **B — Señal hacia implementación** | **Claude Code → Cursor** | Claude Code deja en §5.1 / §6 síntomas, hipótesis y pedidos de cambio. **Cursor** vuelca en código lo acordado y, además, **debe** reflejar estado de producto y pendientes en `TASKS/backlog-producto-pendientes.md` (hoja de ruta principal). Este archivo **no** sustituye al backlog: solo coordina la fricción Cursor ↔ Claude en IA venta. |

**Regla explícita para Cursor (también en `.cursor/rules/40-cursor-backlog-coordinacion.mdc`):** al iniciar sesión, leer siempre `TASKS/backlog-producto-pendientes.md` y seguir actualizándolo con avances y pendientes como hasta ahora. Si hay **varios chats** trabajando release + backlog a la vez, leer además **`TASKS/leer-primero.md`** y, al cerrar un ciclo, rellenar **§11** de este archivo. La coordinación IA es complementaria.

**Claude Code:** no está obligado por la regla `.cursor/` del repo; el usuario le indica leer este archivo y el backlog cuando haga falta contexto de producto.

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
| 2026-04-24  | Cursor | Identificadores vs nombres (PG)  | Fase1 LISTO | Columna `reservas.estado_gestion_id` + código dual (nombre sincronizado). Migración: `backend/db/migrations/reservas-estado-gestion-id.sql`. SPA gestión/reservas/calendario alineados parcialmente — ver `TASKS/audit-identificadores-vs-nombres-ui.md` § avance. **Siguiente:** ejecutar SQL en Supabase; fase 2 canal/plantilla IA, `reservas.estado` principal, jobs SQL. |
| 2026-04-24  | Claude | `consultarDisponibilidad` / bug  | LISTO    | Fix: `resolveEmpresaPgId` + `unavailableProperties`; commit `e27f151` |
| 2026-04-24  | Claude | Estrategia multi-canal IA venta  | EN CURSO | Ver §9 — roadmap por canal y tier |
| 2026-04-24  | Cursor | `GET /api/disponibilidad` enriquecida + vibe búsqueda + confirmación reserva | LISTO | `publicAiDisponibilidadService.js`, `evaluarRestriccionesReservaWebCodigo`, `suitemanagerApiController`, OpenAPI; `requiere_confirmacion_final` en detalle; validación email/tel `publicAiController`. |
| 2026-04-25  | Cursor | Backlog producto (`TASKS/backlog-producto-pendientes.md`) | LISTO | Actualizado §4: mapa de calor cerrado funcionalmente (panel + calendario + validación por llegada), pendientes movidos a QA E2E/copy. |
| 2026-04-25  | Cursor | Release 1.0.0 — `test:ci` + plan + CI workflow | LISTO | `package.json` `test:ci` ampliado (smoke §2 scripts); `TASKS/plan-release-1.0.0.md` §2.1; `backend/scripts/test-integrations-settings-sanitize.js`; `.github/workflows/ci-smoke.yml` → `npm run test:ci`. Smoke manual §2.3 y push tag `v1.0.0` pendientes operación/staging. |

**Convención de estados:** `EN CURSO` | `LISTO` | `PAUSA` | `BLOQUEADO`.

---

## 3. Zona caliente — coordinar antes de cambiar en paralelo

Estas piezas afectan **directamente** lo que ve ChatGPT / acciones OpenAPI y lo que calcula el sitio público. Si Cursor va a tocarlas, avisar aquí; si Claude Code ajusta contrato o flujo, avisar igual.

| Tema | Archivos / rutas típicas | Riesgo si no se coordina |
|------|---------------------------|---------------------------|
| Precio reserva / tarifas | `calculoValoresService.js`, `tarifasService.js` (`obtenerTarifasParaConsumidores`), `website.shared.js` (`fetchTarifasYCanal`), `publicWebsiteService.js` | Totales distintos IA vs checkout; promos `metadata.promo` desalineadas |
| Reserva pública IA | `publicAiController.js` (`createPublicReservation`, `quotePriceForDates`, `createBookingIntent`) | 422/409, montos incorrectos, doble canal (`IA Reserva` vs default). **2026-04-24:** al tocar este archivo, alinear con regla *id/semántica, no nombre de canal/plantilla* (`SHARED_CONTEXT.md`, `TASKS/audit-identificadores-vs-nombres-ui.md`) |
| OpenAPI / GPT | `openapi/openapi-chatgpt.yaml`, `suitemanagerApiController.js`, `publicRoutes.js` | El agente llama endpoints rotos o con body distinto |
| Checkout web SSR | `website.booking.js`, `reservar.ejs`, `public/js/checkout.js`, `crearReservaPublica`, reconciliación precio, aceptación términos | Regresiones en reserva humana al “alinear” IA |

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

- 2026-04-25 — Cursor — **Release 1.0.0 (puerta técnica):** `npm run test:ci` ampliado (`package.json`) con tests alineados a smoke plan §2.1; `plan-release-1.0.0.md` actualizado; `ci-smoke.yml` ejecuta `test:ci`; script `test-integrations-settings-sanitize.js`. Pendiente: smoke manual §2.3 staging + tag `v1.0.0` + push integrador.
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
- 2026-04-24 — Cursor — **§11** coordinación cierre 1.0.0 + agente B: enlaces `leer-primero.md` / `plan-release-1.0.0.md`; primera fila estado gate CI + pendientes smoke/tag (ver §11.2).

---

## 7. Referencia rápida — superficie IA venta

| Qué | Dónde |
|-----|--------|
| Crear reserva desde agente | `POST /api/public/reservas` o `POST /api/reservas` → `publicAiController.createPublicReservation` |
| Cotizar reserva (dry-run) | `POST /api/reservas/cotizar` o `POST /api/public/reservas/cotizar` → `publicAiReservaCotizacionService.cotizarReservaIaPublica`; OpenAPI **1.4.4** |
| OpenAPI ChatGPT | `openapi/openapi-chatgpt.yaml` |
| Motor de precio compartido (panel / propuestas / muchas rutas) | `services/utils/calculoValoresService.js` |
| Precio checkout SSR + reconciliación | `publicWebsiteService.js` |
| Backlog producto (tarifas, §4 checkout) | `TASKS/backlog-producto-pendientes.md` |

---

## 8. Bloqueos / decisiones pendientes

| Fecha      | Quién  | Tema                                              | Estado    |
|------------|--------|---------------------------------------------------|-----------|
| 2026-04-24 | Claude | `empresa_id` en propiedades usa Firestore doc ID vs slug en otras tablas — mapeado con `resolveEmpresaPgId` como workaround. Validar si propiedades debe migrar su campo o se mantiene el resolver. | Abierto |
| 2026-04-24 | Claude | ¿Se aprueba construir MCP Server en `backend/mcp/`? Necesita agregar `@modelcontextprotocol/sdk` a `package.json`. Decisión del usuario. | Pendiente usuario |

---

## 9. Estrategia multi-canal IA venta — hoja de ruta (Claude Code como líder)

_Actualizado: 2026-04-24. Revisar y ajustar al inicio de cada sprint IA._

### Mapa de canales y protocolo técnico

| Canal / Plataforma | Protocolo / Standard | Tier | Responsable |
|--------------------|----------------------|------|-------------|
| **ChatGPT** (Actions/GPT) | OpenAPI 3.1 (`openapi-chatgpt.yaml`) | ✅ Activo | Claude (refinamiento) |
| **Claude** (Desktop, IDE, API) | **MCP Server** (`@modelcontextprotocol/sdk`) | 🔴 P1 | Claude Code |
| **Perplexity / buscadores IA** | `llms.txt` + sitemap XML | 🔴 P1 | Claude Code + Cursor |
| **Google AI Overview (SGE)** | JSON-LD mejorado (LodgingBusiness, BookAction, FAQ) | 🔴 P1 | Cursor |
| **Gemini** (Google AI Studio) | OpenAPI (`openapi-gemini.yaml`) — mismo backend | 🟡 P2 | Claude Code |
| **WhatsApp Business** | Meta Business API webhook → `publicAiController` | 🟡 P2 | Claude Code + Cursor |
| **Google Hotels** | ARI XML feed (OTA-connect) — `googleHotelsService.js` | 🟡 P2 | Claude + Cursor |
| **Bing / Microsoft Copilot** | Plugin OpenAPI + Bing Webmaster | 🟠 P3 | Claude Code |
| **Instagram / Facebook DM** | Meta Business API (Messenger Platform) | 🟠 P3 | Cursor |
| **Alexa / Google Assistant** | Voice intents / Smart Home API | 🔵 P4 | futuro |

---

### Tier 1 — Implementación inmediata (Claude Code)

#### 1A. MCP Server para Claude
**Qué:** servidor MCP (`Model Context Protocol`, standard Anthropic) que expone las herramientas de reserva. Cualquier usuario de Claude Desktop, Claude.ai con MCP, o agente que use el SDK de Anthropic puede buscar cabañas y reservar sin salir de Claude.

**Cómo:** `backend/mcp/staymanager-mcp-server.js` con transporte `stdio`. Herramientas: `buscar_propiedades`, `consultar_disponibilidad`, `cotizar_precio`, `crear_reserva`, `obtener_detalle`. Sirve el mismo backend que ChatGPT — sin duplicar lógica.

**Archivo de configuración para el usuario final** (`mcp-config.json`): describe cómo agregar SuiteManager a Claude Desktop.

**Decisión pendiente:** aprobación de Pablo para agregar `@modelcontextprotocol/sdk` al `package.json`.

#### 1B. `llms.txt` por tenant
**Qué:** archivo estático en `/llms.txt` (y `/llms-full.txt`) servido por el SSR de cada empresa. Perplexity, Claude con búsqueda web, SearchGPT, Brave AI lo leen para entender qué ofrece el sitio.

**Contenido:** nombre empresa, descripción, propiedades listadas (nombre, capacidad, precio desde), instrucción de booking ("Para reservar, usar `POST https://suite-manager.onrender.com/api/reservas`"), contacto.

**Quién lo implementa:** yo (Claude Code) — ruta nueva en `website.home.js` o `website.js`, generada dinámicamente desde la BD.

#### 1C. Cotizar precio / dry-run antes de reservar (OpenAPI + API)
**Estado:** **Entregado (2026-04-24, Cursor).** No hace falta `GET /api/cotizar` global.

- **Precio rápido por propiedad:** `GET /api/public/propiedades/:id/cotizar?fechaInicio=&fechaFin=` (ya existía).
- **Dry-run alineado a checkout y política (sin persistir):** `POST /api/reservas/cotizar` y `POST /api/public/reservas/cotizar` → `publicAiReservaCotizacionService.cotizarReservaIaPublica`; OpenAPI ChatGPT/Gemini **1.4.2** documenta ambos paths.

**Pendiente de producto (opcional):** si se quiere un único alias tipo `GET /api/cotizar` por ergonomía de Actions, valorar; hoy los contratos YAML son la fuente.

---

### Tier 2 — Sprint siguiente (coordinación Claude + Cursor)

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

**Cuándo usar:** al terminar (o pausar) el reparto descrito en **`TASKS/leer-primero.md`**: Agente A = cierre 1.0.0 (`plan-release-1.0.0.md`), Agente B = **§5 ítem 2** del backlog (preferencias/copy motor **§1.6**, salvo que el usuario redirija a otra fila §5).

**Qué hacer:** copiar la plantilla de la siguiente subsección debajo de la línea `---` del bloque vigente, rellenar, y marcar en **`plan-release-1.0.0.md` §2** los checkboxes del smoke si aplica.

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
| Smoke manual plan §2 (staging) | pendiente | Checklist §2.3 en `plan-release-1.0.0.md` + tabla §2.1. |
| Tag `v1.0.0` aplicado | SÍ (local) | Commit gate CI; push tras smoke §2.3 (`leer-primero.md` §5.1). |
| Agente B — backlog §5 ítem 2 (§1.6) | pendiente | Otro chat según reparto. |
| Próxima asignación sugerida | | Smoke §2.3 → tag → §4.3 D / §5. |
```

| Ítem | Estado | Nota |
|------|--------|------|
| `npm run test:ci` (rama candidata) | SÍ | 2026-04-25: cadena ampliada + verde local (`package.json`, workflow CI). |
| `npm run test:ssr` (SSR arriba) | omitido | Opcional hasta smoke de vistas públicas. |
| Smoke manual plan §2 (staging) | pendiente | Checklist en `plan-release-1.0.0.md` §2.3 / §2.1. |
| Tag `v1.0.0` aplicado | SÍ (local) | Anotado en commit gate CI; **push** tras smoke §2.3 + acuerdo integrador. |
| Agente B — backlog §5 ítem 2 (§1.6) | pendiente | Otro chat / agente según `leer-primero.md`. |
| Próxima asignación sugerida | | Completar smoke §2.3 → tag; luego §5.3 dominio, §2.3 widget, §1.4 iCal, §4.3 D según prioridad. |

---

*Última revisión: 2026-04-25 — §11 actualizado (test:ci ampliado, CI workflow); Claude Code liderazgo IA venta §9; §10 multi-agente TASKS.*
