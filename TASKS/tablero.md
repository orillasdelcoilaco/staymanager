# Tablero de temas (vista en Markdown)

Vista operativa por **iniciativa**: cada fila es una **tarjeta** y un **`TASKS/tema/<id>/`**. El roadmap formal sigue en **`backlog-producto-pendientes.md`**; este archivo es estado **operativo** y handoff entre sesiones.

**IDs:** la columna **ID** es el nombre de carpeta bajo **`TASKS/tema/`** (sin espacios). Dentro de cada carpeta: **archivos sueltos** del tema (`qa-`, `audit-`, `checklist-`, etc.); sin subcarpetas obligatorias — **`TASKS/tema/README.md`**.

**Agentes:** al **iniciar**, **durante** y **cerrar** trabajo en un tema, mantener **esta tabla** actualizada junto con la carpeta **`tema/<id>/`** (regla **`.cursor/rules/50-tasks-tablero-y-temas.mdc`**, **`LEER-PRIMERO.md`** § *Flujo al iniciar o retomar*).

**Flujo:** contexto (`LEER-PRIMERO`) → **tema** (fila + `TASKS/tema/<id>/`) → **qué hacer** (usuario + docs del tema). Tras **crear / modificar / eliminar** algo relevante al tema: **actualizar la fila** (fecha en *Última nota*, estado en *Columna*).

**Humano (Cursor):** renombrar la **pestaña del chat** con el **nombre del tema** (columna *Tema* o ID `SM-*`) para coincidir con el tablero.

---

## Columnas (estados)

| Columna | Significado |
|---------|-------------|
| **Backlog** | No iniciado o pausado sin bloqueo activo. |
| **En curso (Cursor)** | Trabajo activo en Cursor (nombrar el chat igual que el título del tema). |
| **En curso (Claude u otro)** | Misma iniciativa fuera de Cursor. |
| **Bloqueado** | Falta decisión, dato externo, release o coordinación. |
| **Listo** | Cerrado en código/doc o merge acordado. |

---

## Tablero (IDs ↔ carpetas)

*Filas alineadas a **`backlog-producto-pendientes.md`**. Carpeta = `TASKS/tema/<ID>`.*

| ID | Tema (título) | Columna | Rama | Carpeta tema | Herramienta | Última nota (fecha) | Enlaces |
|----|---------------|---------|------|--------------|-------------|---------------------|---------|
| `SM-rel-v100` | Cierre release v1.0.0 (smoke, `test:ci`, tag) | Backlog | — | `tema/SM-rel-v100` | — | 2026-05-05 — Foco §5.x E: smoke `tema/SM-rel-v100/plan-release-1.0.0.md` §2.3 + CI antes del tag | `tema/SM-rel-v100/plan-release-1.0.0.md`, backlog §5.x E |
| `SM-ghc-onboarding` | Google Hotel Center — partner directo (deploy / onboarding) | Listo | — | `tema/SM-ghc-onboarding` | — | 2026-05-03 — **Cerrado comercialmente** (Google no nuevos partners directos). Código + checklists en **standby**; **no tocar** módulos partner (`googleHotels*`, rutas `/feeds/google` plataforma, bloque feeds globales en Canales IA) salvo bug crítico o instrucción explícita. Ver `venta-ia.md` §7.0 | `tema/SM-ghc-onboarding/README.md`, `google-hotels-partner-deploy-checklist.md`, `checklist-onboarding-google-hotel-center.md`, `tema/SM-venta-ia/venta-ia.md` §7.0 |
| `SM-venta-ia` | Canales venta / venta por IA (OpenAPI, MCP, feeds) | En curso (Cursor) | — | `tema/SM-venta-ia` | Cursor | Carril unificado `tema/SM-venta-ia/venta-ia.md`; zona caliente en coordinación | `tema/SM-venta-ia/venta-ia.md`, `tema/SM-venta-ia/qa-y-seguimiento-prelaunch-canales.md`, `tema/SM-venta-ia/qa-feed-ari-checklist.md`, `tema/SM-venta-ia/gemini-smoke-instrucciones.md`, coordinación, regla `45-canales-venta-solo-cursor.mdc` |
| `SM-beds24` | Integración Beds24 (CM → Google + API + conector SM) | Backlog | — | `tema/SM-beds24` | Ops + Cursor | 2026-05-03 — Plan maestro + guía operativa; fase código cuando priorice backlog | `tema/SM-beds24/plan-accion-beds24.md`, `tema/SM-beds24/beds24-integracion-inicio.md`, `tema/SM-gh-strategy-cm/google-hotels-estrategia-post-partner-google.md`, backlog §5.3 |
| `SM-gh-strategy-cm` | Estrategia Google post-partner (channel manager) | Backlog | — | `tema/SM-gh-strategy-cm` | — | 2026-05-03 — Contexto comercial + inventario; ejecución en **`SM-beds24`** | `tema/SM-gh-strategy-cm/google-hotels-estrategia-post-partner-google.md`, `tema/SM-beds24/plan-accion-beds24.md`, backlog §5.3 |
| `SM-heatmap-qa` | Mapa de calor / restricciones (§5.x A) | Listo | — | `tema/SM-heatmap-qa` | — | Criterio técnico cerrado; QA manual opcional | `tema/SM-heatmap-qa/qa-heatmap-restricciones-e2e.md` §12 |
| `SM-comparador-ota` | Comparador OTA — MVP (§5.x C) | Listo | — | `tema/SM-comparador-ota` | — | 2026-05-05 — Cierre DoD MVP validado; QA contractual cubierto por `test-comparador-ota-service.js` en `npm run test:ci` | `tema/SM-comparador-ota/README.md`, `tema/SM-venta-ia/venta-ia.md` §5.2, backlog §5.x C |
| `SM-mail-events-mtx` | Motor correo — nuevos eventos / matriz (§1.2) | Backlog | — | `tema/SM-mail-events-mtx` | — | Diferido al final del roadmap | `transactionalEmailEventMatrix.js`, backlog §5 ítem 6 |
| `SM-legal-checkout` | §4 legal / checkout — retomar | Backlog | — | `tema/SM-legal-checkout` | — | Pendientes §4.1 | backlog §4.1 |
| `SM-ids-vs-names` | Identificadores vs nombres (PG + SPA) | Backlog | — | `tema/SM-ids-vs-names` | — | Migración SQL en entornos PG | `tema/SM-ids-vs-names/audit-identificadores-vs-nombres-ui.md` |
| `SM-spa-menu` | Plan reorganización menú SPA | Listo | — | `tema/SM-spa-menu` | — | 2026-05-05 — Doc bajo `tema/` (oleada 2) | `tema/SM-spa-menu/plan-reorganizacion-menu-spa.md` |
| `SM-ssr-sitio-publico` | SSR / sitio público (arquitectura, empresa, wizard contenido) | Listo | — | `tema/SM-ssr-sitio-publico` | — | 2026-05-05 — Planes agrupados | `tema/SM-ssr-sitio-publico/plan-ssr-arquitectura-dos-capas.md`, `plan-accion-ssr-empresa.md`, `plan-contenido-web-wizard.md` |
| `SM-fotos-galeria` | Fotos, galería, IMG-001, baños | Listo | — | `tema/SM-fotos-galeria` | — | 2026-05-05 — Guías y planes de corrección | `tema/SM-fotos-galeria/` (5 archivos) |
| `SM-dev-historial` | Historial de problemas / acciones dev | Listo | — | `tema/SM-dev-historial` | — | 2026-05-05 | `tema/SM-dev-historial/plan-accion-problemas.md` |
| `SM-clientes-crm` | Clientes sin reserva / CRM | Listo | — | `tema/SM-clientes-crm` | — | 2026-05-05 | `tema/SM-clientes-crm/plan-accion-clientes-sin-reserva.md` |
| `SM-propiedades` | Gestión de propiedades (plan) | Listo | — | `tema/SM-propiedades` | — | 2026-05-05 | `tema/SM-propiedades/plan-gestion-propiedades.md` |
| `SM-ia-arquitectura` | Arquitectura IA / Gemma | Listo | — | `tema/SM-ia-arquitectura` | — | 2026-05-05 | `tema/SM-ia-arquitectura/acuerdo-arquitectura-ia.md`, `plan-gemma4-omnipresente.md` |
| `SM-auditoria-calidad` | Auditorías UI/complexity, performance, solo-ui | Listo | — | `tema/SM-auditoria-calidad` | — | 2026-05-05 — Salida de `audit-ui.js` / `audit-complexity.js` aquí | `tema/SM-auditoria-calidad/audit-report.md`, `complexity-report.md`, `plan-auditoria-frontend.md` |
| `SM-onboarding-ux` | Onboarding en video (plan) | Listo | — | `tema/SM-onboarding-ux` | — | 2026-05-05 | `tema/SM-onboarding-ux/plan-video-onboarding.md` |
| `SM-migracion-postgres` | Plan migración PostgreSQL | Backlog | — | `tema/SM-migracion-postgres` | Claude / integrador | Estado en `SHARED_CONTEXT` § DB | `tema/SM-migracion-postgres/migration-plan-postgres.md` |
| `SM-operacion-agentes` | Pending/completed agentes, DoD, alertas créditos | Listo | — | `tema/SM-operacion-agentes` | CI + OpenClaw | 2026-05-05 — Workflows `notify-*` apuntan aquí | `tema/SM-operacion-agentes/pending.md`, `tema/SM-operacion-agentes/completed.md`, `tema/SM-operacion-agentes/definition-of-done.md`, `tema/SM-operacion-agentes/alertas-creditos.md` |

**Release:** §5.x **E** — **A** y **C** listos; **B** (partner Google **directo**) cerrado en alcance comercial 2026-05-03 (standby); avance Google vía **`SM-beds24`**. Revisar criterio de salida en backlog §5.x **E**.

---

## Plantilla — nueva fila + carpeta

1. Elegir **`SM-<slug>`** único (ver `tema/README.md`).
2. Añadir fila arriba.
3. Crear **`TASKS/tema/<id>/README.md`** y subcarpetas (`test/`, `debug/`, …) según necesidad.

```text
| SM-mi-slug | Título corto | Backlog | rama-opcional | tema/SM-mi-slug | Cursor | YYYY-MM-DD — nota | enlaces |
```

---

## De dónde salen los temas

Derivar filas de **`backlog-producto-pendientes.md`**. En **`TASKS/`** (raíz) permanecen el **`backlog`**, **`tablero.md`**, los archivos de **coordinación** y la entrada **`LEER-PRIMERO.md`** (raíz del repo). El **roadmap del carril venta por IA** está en **`tema/SM-venta-ia/venta-ia.md`** (tabla **`SM-venta-ia`**); **`TASKS/venta-ia.md`** es un puntero opcional para enlaces antiguos. **`tema/<id>/`** acumula lo **específico de cada iniciativa**.

