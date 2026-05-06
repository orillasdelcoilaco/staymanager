# LEER-PRIMERO.md — Antes de actuar en este repositorio

**Para ti (humano):** puedes decirle a cualquier agente **solo esto**:

> Antes de hacer algo, lee `LEER-PRIMERO.md` en la raíz del repo.

**Para el agente:** abre este archivo al inicio de la sesión en la que vayas a tocar código, `TASKS/`, migraciones o despliegue. No reemplaza el resto de la documentación: define **en qué orden** leerla, **cómo evitar pisar** a otro agente en los mismos archivos y **una sola línea de enganche** a estándares de código y producto.

---

## Orden de lectura (obligatorio)

1. `**SHARED_CONTEXT.md`** — Estado real del proyecto: arquitectura, modo dual PostgreSQL/Firestore, multi-tenant, tablas y convenciones. Si hay conflicto con otro documento, **gana** este.
2. `**TASKS/coordinacion-cursor-claude-ia-venta.md`** — Como mínimo: **§2 Estado actual**, **§3** (locks), **§10** (varios agentes y el mismo `TASKS/*.md`). Si vas a editar `TASKS/backlog-producto-pendientes.md` u otro markdown compartido y §2 muestra **EN CURSO** por **otro** actor, **no** modifiques ese archivo hasta que el usuario lo coordine.
3. `**TASKS/backlog-producto-pendientes.md`** — Roadmap de producto cuando el trabajo afecte hitos, prioridades o cierres de tarea (después del paso 2 para respetar locks y filas EN CURSO).
4. `**TASKS/tema/SM-venta-ia/venta-ia.md**` — Si el trabajo afecta **venta por IA** o **canales externos** (OpenAPI / ChatGPT Actions, MCP, Google Hotels y Travel, feeds ARI, Perplexity / middleware, redes o mensajería comercial): leer este archivo además del backlog (**§5.3** del backlog enlaza aquí el detalle). Incluye el panel SPA **Operaciones → Canales IA** (`/canales-ia`) como punto único de configuración usuario para tokens de feeds, semáforo Google Hotels y datos por alojamiento (**§2.6**). **Google Hotel Center** como **connectivity partner** (feeds/listado agregado en dominio plataforma, landing central, **§1.1 y §7**; diseño cerrado, gate XSD y operación certificación **§7.9–§7.11**) se distingue de “vender vía OTA de terceros”; la **sincronización operativa** (iCal, reportes, importación de reservas hacia el PMS) es otro ámbito y **sí** forma parte del producto donde ya esté definida.
5. `**CLAUDE.md`** — Convenciones del repo: modularidad, límites de tamaño, modo dual, multi-tenant, **design system** / Tailwind tokens, auditorías obligatorias tras cambios, fuente financiera. Léelo también si trabajas en **Cursor** cuando implementas (no solo si eres Claude Code CLI).

**Cadena única:** el usuario puede pedir solo «lee `LEER-PRIMERO.md`»; con los pasos **1 → 5** y la siguiente sección (**Estándares de implementación**) ya quedan cubiertos contexto de producto, coordinación y reglas de programación sin repetir la charla en cada sesión.

---

## Flujo al iniciar o retomar una tarea (orden fijo)

_Tarea nueva o continuación: siempre el mismo orden._

1. **Contexto** — Seguir el **Orden de lectura** de arriba (como mínimo **`SHARED_CONTEXT.md`**); añadir coordinación, backlog, `venta-ia`, **`CLAUDE.md`**, etc., según aplique (locks en §2 del archivo de coordinación antes de editar markdown compartido).
2. **Tema** — Abrir **`TASKS/tablero.md`**, identificar el **ID** (`SM-*`) y la carpeta **`TASKS/tema/<id>/`**. Si la iniciativa aún no tiene fila: **crear fila en el tablero + carpeta del tema** (convención **`TASKS/tema/README.md`**). Leer **`README.md` del tema** si existe y los `.md` principales de esa carpeta (plan, QA, checklist). **Fase solo conversación / diseño:** si aún no hay código pero ya hubo iteración sobre el problema y soluciones, crear o actualizar un **`plan-accion-*.md`** en esa carpeta y añadir una viñeta en su **§ bitácora** (plantilla en **`TASKS/tema/README.md`** — *Fase de descubrimiento*); enlazar ese archivo en la columna **Enlaces** del tablero cuando sea el doc maestro del tema.
3. **Qué hacer** — Ejecutar lo que pide el usuario y lo acordado en los docs del tema / backlog.

**Tablero siempre al día:** cuando el agente **cree, modifique o elimine** algo **pertinente al tema** (código, docs bajo `TASKS/tema/<id>/`, contratos OpenAPI del carril, etc.), debe **actualizar la fila** de ese tema en **`TASKS/tablero.md`**: **Última nota** con fecha (YYYY-MM-DD) y una línea de **dónde quedó** el trabajo; ajustar **columna** si cambia el estado (p. ej. Backlog → En curso al arrancar; En curso → Listo al cerrar); **enlaces** si cambian archivos clave. Objetivo: que **otra sesión o agente** sepa el estado sin releer el chat. Detalle operativo: **`.cursor/rules/50-tasks-tablero-y-temas.mdc`**.

**Humano en Cursor:** renombrá la **pestaña del chat** con el **nombre del tema** (título de la columna *Tema* en `tablero.md` o el ID `SM-*`) para mantener el mismo orden mental que el tablero.

---

## Estándares de implementación (calidad, datos y UI)

Todo lo detallado sigue viviendo en `**CLAUDE.md`** y reglas; aquí va la **línea única** para enganchar al próximo agente.


| Tema                                                                         | Dónde está definido / qué hacer                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenant y modo dual**                                                 | `SHARED_CONTEXT.md`, `CLAUDE.md`; PostgreSQL con `empresa_id`; Firestore bajo `empresas/{id}/...`; sin cruzar SPA y SSR.                                                                                             |
| **Sin hardcode de negocio**                                                  | Reglas y datos en BD/config; nuevas reglas vía tablas o settings, no constantes mágicas en código.                                                                                                                   |
| **Producto genérico (no acoplado a un tenant de ejemplo)**                | El desarrollo puede usar una empresa de prueba (complejo, N alojamientos, espacios), pero **el código no debe asumir** esa empresa, esa cantidad ni ese layout: todo lo variable va por `empresa_id` y parametría. Ver `.cursor/rules/06-producto-generico-sin-tenant-demo.mdc` y `CLAUDE.md` (sistema paramétrico). |
| **IDs en lógica y datos; nombres solo en UI**                                | En reglas, APIs, joins y almacenamiento: **referenciar por id** (estados, propiedades, tipos, etc.); los **nombres** son etiquetas editables y no deben ser la clave del negocio. Misma regla **`.cursor/rules/06-producto-generico-sin-tenant-demo.mdc`**; seguimiento **`TASKS/tema/SM-ids-vs-names/audit-identificadores-vs-nombres-ui.md`**. |
| **Índices y migraciones**                                                    | Migraciones SQL explícitas cuando haga falta índice o columna; seguir convenciones ya usadas en el repo.                                                                                                             |
| **CSS / UI**                                                                 | Tokens semánticos (`primary-*`, `danger-*`, …) en `backend/tailwind.config.js`; **no** colores Tailwind sueltos donde el proyecto prohíbe; SPA: `.claude/skills/frontend.md` + botones `.btn-*` donde aplique.       |
| **Auditorías después de cambiar código**                                     | Desde la raíz: `node scripts/tooling/audit-ui-monitored.js` si tocaste UI; `node scripts/tooling/audit-complexity-monitored.js` si tocaste lógica (ver números exactos en `CLAUDE.md`).                                              |
| **Menú SPA (Inventario, Sitio público, Canales IA, handoff entre sesiones)** | **Referencia única:** `TASKS/tema/SM-spa-menu/plan-reorganizacion-menu-spa.md` — fases, mapa, qué no tocar (p. ej. Flujo de Trabajo). **Lista de QA + siguiente paso Google/OpenAPI:** `TASKS/tema/SM-venta-ia/qa-y-seguimiento-prelaunch-canales.md`. |
| **Modularidad**                                                              | Respetar límites de archivo/función/export en `CLAUDE.md`; **preferir archivos o funciones nuevas** antes de reescribir bloques grandes que ya funcionan.                                                            |
| **Ubicación de archivos (todos los agentes)**                                | **No** crear artefactos nuevos en la raíz del repo ni en rutas improvisadas. Código → `backend/` / `frontend/src/`; OpenAPI y contratos públicos → `backend/openapi/`; tooling IA (MCP, agentes, plantillas) → `backend/ai/`; scripts recurrentes → `scripts/tooling/` o `scripts/legacy/` según convención; planes, QA e informes por iniciativa → **`TASKS/tema/<SM-id>/`** (`TASKS/tablero.md`). Detalle: **`CLAUDE.md`** (Flujo de trabajo), **`SHARED_CONTEXT.md`** (cabecera), regla **`.cursor/rules/07-artifact-placement-repo-layout.mdc`**. |
| **No romper lo estable**                                                     | Cambios **mínimos** y **aislados** en rutas ya probadas; nuevas capacidades en **módulos nuevos** o detrás de helpers claros; no ensanchar el alcance del PR sin necesidad.                                          |
| **Dominio, host API, GPT (texto en docs y prompts, no lógica de negocio)**  | Usar la sección **Referencias de entorno** (debajo). Evita placeholders genéricos en handoffs; si el host de Render cambia, actualizar tabla y runbooks que lo citen. **No** codificar un tenant concreto como única realidad: el producto sigue multi-tenant. |


**Cursor:** las reglas en `**.cursor/rules/`** (`00-core-safety.mdc`, `07-artifact-placement-repo-layout.mdc`, modo dual, backlog, etc.) aplican **además** de lo anterior. **Política de qué va en cada `.mdc` e índice de rules:** `.cursor/rules/README.md`. Skill `**.cursor/skills/staymanager-executor/SKILL.md`** para trabajo backend/SSR/SPA en StayManager. **Tablero operativo por tema:** `TASKS/tablero.md` (IDs ↔ carpetas `TASKS/tema/<id>/`; convención `TASKS/tema/README.md`). Agentes: regla **`50-tasks-tablero-y-temas.mdc`**. No sustituye al backlog.

**Varios agentes Cursor en paralelo:** después de este archivo, si aplica release vs backlog, seguir `**TASKS/coordinacion-cursor-paralelo.md`** (bitácora §5.3, integrador). **Solo** la raíz tiene `LEER-PRIMERO.md`; no confundir con el doc multi-agente.

---

## Referencias de entorno (operación, handoffs, OpenAPI, prompts)

**Propósito:** que documentación, prompts a Claude Code / otros agentes y runbooks usen **nombres reales** y no `ejemplo.com`, `tu-servicio.onrender.com` o `[EMPRESA]` como texto a reemplazar a mano. **Esto no es dato de negocio en código:** el producto sigue siendo paramétrico por `empresa_id`; aquí solo fijamos **plataforma, DNS y despliegue** tal como están hoy en producción.

| Qué | Valor canónico |
|-----|----------------|
| **Dominio de plataforma (marketplace, site principal)** | `suitemanagers.com` — registro DNS en **GoDaddy** |
| **Sitio público por empresa (subdominio)** | `https://{subdominio}.suitemanagers.com` — el `{subdominio}` viene de la configuración de cada empresa, no es fijo en código. |
| **Tenant de ejemplo real (pruebas E2E, copy en docs)** | `orillasdelcoilaco` → `https://orillasdelcoilaco.suitemanagers.com` (una empresa concreta; otras empresas usan otro subdominio). |
| **Backend / API pública (host en Render)** | `https://suite-manager.onrender.com` — servicio **Render** vinculado al repo en **GitHub**; el deploy de producción sigue el flujo acordado del equipo (p. ej. push a `main`). Si en el dashboard de Render el nombre del servicio o la URL canónica difieren, **gana el valor del dashboard** y conviene **actualizar esta fila** en el mismo commit que el cambio de infra. |
| **OpenAPI (ChatGPT / Actions, verificación de contrato)** | `https://suite-manager.onrender.com/openapi-chatgpt.yaml` y `https://suite-manager.onrender.com/openapi-gemini.yaml` (servidos por el backend). |
| **Health de versión de contrato API** | `GET https://suite-manager.onrender.com/api/public/version` — campo `version` alineado a `info.version` del OpenAPI (p. ej. 1.4.8) salvo `PUBLIC_API_CONTRACT_VERSION` en env. |
| **GPT en ChatGPT (nombre del conector / asistente comercial)** | **SuiteManager Marketplace IA** — el Action debe apuntar al host anterior para esquema y URLs base. Tras cambiar el OpenAPI: **reimportar el schema** en la configuración del GPT, **guardar** y probar en **un chat nuevo** (evita herramientas desactualizadas). La edición/prueba fiable de GPT con Actions suele requerir **ChatGPT Plus** (o plan equivalente); sin Plus puede quedar **pendiente** la verificación conversacional. |

**Código de referencia:** el dominio de plataforma por defecto en el repo suele aparecer como `PLATFORM_DOMAIN` / `PUBLIC_SITES_ROOT_DOMAIN` (p. ej. `suitemanagers.com`). Comportamiento multi-tenant: **SHARED_CONTEXT.md** y reglas de producto genérico.

---

## Regla corta (multi-agente)

El archivo de **coordinación** (`TASKS/coordinacion-cursor-claude-ia-venta.md`) es quien indica **quién está moviendo** qué parte de `TASKS/`. El backlog dice **qué** hay que construir; no usemos dos sesiones escribiendo el mismo `.md` a la vez sin pasar por §2 / §10 / LOCK.

## Cursor (recordatorio)

Las reglas en `.cursor/rules/` se aplican **además** de lo anterior. Criterios e índice: `.cursor/rules/README.md`. La regla `40-cursor-backlog-coordinacion.mdc` detalla el flujo del backlog en Cursor.

---

*Última actualización: 2026-05-06 — Referencias de entorno: nota **ChatGPT Plus** + reimport schema + probar en **chat nuevo** tras cambios al OpenAPI. Historial: dominio/API/GPT canónicos; `plan-accion` + bitácora; regla `50`; `coordinacion-cursor-paralelo.md`.*