# LEER-PRIMERO.md — Antes de actuar en este repositorio

**Para ti (humano):** puedes decirle a cualquier agente **solo esto**:

> Antes de hacer algo, lee `LEER-PRIMERO.md` en la raíz del repo.

**Para el agente:** abre este archivo al inicio de la sesión en la que vayas a tocar código, `TASKS/`, migraciones o despliegue. No reemplaza el resto de la documentación: define **en qué orden** leerla, **cómo evitar pisar** a otro agente en los mismos archivos y **una sola línea de enganche** a estándares de código y producto.

---

## Orden de lectura (obligatorio)

1. **`SHARED_CONTEXT.md`** — Estado real del proyecto: arquitectura, modo dual PostgreSQL/Firestore, multi-tenant, tablas y convenciones. Si hay conflicto con otro documento, **gana** este.
2. **`TASKS/coordinacion-cursor-claude-ia-venta.md`** — Como mínimo: **§2 Estado actual**, **§3** (locks), **§10** (varios agentes y el mismo `TASKS/*.md`). Si vas a editar `TASKS/backlog-producto-pendientes.md` u otro markdown compartido y §2 muestra **EN CURSO** por **otro** actor, **no** modifiques ese archivo hasta que el usuario lo coordine.
3. **`TASKS/backlog-producto-pendientes.md`** — Roadmap de producto cuando el trabajo afecte hitos, prioridades o cierres de tarea (después del paso 2 para respetar locks y filas EN CURSO).
4. **`TASKS/venta-ia.md`** — Si el trabajo afecta **venta por IA** o **canales externos** (OpenAPI / ChatGPT Actions, MCP, Google Hotels y Travel, feeds ARI, Perplexity / middleware, redes o mensajería comercial): leer este archivo además del backlog (**§5.3** del backlog enlaza aquí el detalle). Incluye el panel SPA **Operaciones → Canales IA** (`/canales-ia`) como punto único de configuración usuario para tokens de feeds, semáforo Google Hotels y datos por alojamiento (**§2.6**). **Google Hotel Center** como **connectivity partner** (feeds/listado agregado en dominio plataforma, landing central, **§1.1 y §7**; diseño cerrado, gate XSD y operación certificación **§7.9–§7.11**) se distingue de “vender vía OTA de terceros”; la **sincronización operativa** (iCal, reportes, importación de reservas hacia el PMS) es otro ámbito y **sí** forma parte del producto donde ya esté definida.
5. **`CLAUDE.md`** — Convenciones del repo: modularidad, límites de tamaño, modo dual, multi-tenant, **design system** / Tailwind tokens, auditorías obligatorias tras cambios, fuente financiera. Léelo también si trabajas en **Cursor** cuando implementas (no solo si eres Claude Code CLI).

**Cadena única:** el usuario puede pedir solo «lee `LEER-PRIMERO.md`»; con los pasos **1 → 5** y la siguiente sección (**Estándares de implementación**) ya quedan cubiertos contexto de producto, coordinación y reglas de programación sin repetir la charla en cada sesión.

---

## Estándares de implementación (calidad, datos y UI)

Todo lo detallado sigue viviendo en **`CLAUDE.md`** y reglas; aquí va la **línea única** para enganchar al próximo agente.

| Tema | Dónde está definido / qué hacer |
|------|----------------------------------|
| **Multi-tenant y modo dual** | `SHARED_CONTEXT.md`, `CLAUDE.md`; PostgreSQL con `empresa_id`; Firestore bajo `empresas/{id}/...`; sin cruzar SPA y SSR. |
| **Sin hardcode de negocio** | Reglas y datos en BD/config; nuevas reglas vía tablas o settings, no constantes mágicas en código. |
| **Índices y migraciones** | Migraciones SQL explícitas cuando haga falta índice o columna; seguir convenciones ya usadas en el repo. |
| **CSS / UI** | Tokens semánticos (`primary-*`, `danger-*`, …) en `backend/tailwind.config.js`; **no** colores Tailwind sueltos donde el proyecto prohíbe; SPA: `.claude/skills/frontend.md` + botones `.btn-*` donde aplique. |
| **Auditorías después de cambiar código** | Desde la raíz: `node scripts/audit-ui-monitored.js` si tocaste UI; `node scripts/audit-complexity-monitored.js` si tocaste lógica (ver números exactos en `CLAUDE.md`). |
| **Menú SPA (Inventario, Sitio público, Canales IA, handoff entre sesiones)** | **Referencia única:** `TASKS/plan-reorganizacion-menu-spa.md` — fases, mapa, qué no tocar (p. ej. Flujo de Trabajo). **Lista de QA + siguiente paso Google/OpenAPI:** `TASKS/qa-y-seguimiento-prelaunch-canales.md`. |
| **Modularidad** | Respetar límites de archivo/función/export en `CLAUDE.md`; **preferir archivos o funciones nuevas** antes de reescribir bloques grandes que ya funcionan. |
| **No romper lo estable** | Cambios **mínimos** y **aislados** en rutas ya probadas; nuevas capacidades en **módulos nuevos** o detrás de helpers claros; no ensanchar el alcance del PR sin necesidad. |

**Cursor:** las reglas en **`.cursor/rules/`** (`00-core-safety.mdc`, modo dual, backlog, etc.) aplican **además** de lo anterior. Skill **`.cursor/skills/staymanager-executor/SKILL.md`** para trabajo backend/SSR/SPA en StayManager.

**Varios agentes Cursor en paralelo:** después de este archivo, si aplica release vs backlog, seguir **`TASKS/leer-primero.md`** (bitácora §5.3, integrador).

---

## Regla corta (multi-agente)

El archivo de **coordinación** (`TASKS/coordinacion-cursor-claude-ia-venta.md`) es quien indica **quién está moviendo** qué parte de `TASKS/`. El backlog dice **qué** hay que construir; no usemos dos sesiones escribiendo el mismo `.md` a la vez sin pasar por §2 / §10 / LOCK.

## Cursor (recordatorio)

Las reglas en `.cursor/rules/` se aplican **además** de lo anterior. La regla `40-cursor-backlog-coordinacion.mdc` detalla el flujo del backlog en Cursor.

---

*Última actualización: 2026-05-01 — Tabla de estándares: fila **Menú SPA** → referencia única `TASKS/plan-reorganizacion-menu-spa.md`. Historial 2026-05-02: cadena con `CLAUDE.md`; `TASKS/leer-primero.md` para paralelos.*
