# `.cursor/rules` — Qué va aquí y qué no

Este directorio contiene **reglas para el agente de Cursor** (archivos `.mdc` con frontmatter YAML). Son instrucciones **cortas y obligatorias** que el IDE puede aplicar siempre (`alwaysApply`) o solo al editar ciertos paths (`globs`).

**No** es la carpeta raíz de documentación del producto. La entrada humana/agente del repo sigue siendo **`LEER-PRIMERO.md`** en la raíz del proyecto.

---

## 1. Criterio: qué pertenece a una rule

| Sí va en `.cursor/rules` | No va aquí (usar otro sitio) |
|--------------------------|------------------------------|
| Invariantes que no negociar (seguridad, tenant, SPA/SSR, fuente financiera) | Roadmap, hitos, tablas de backlog → `TASKS/backlog-producto-pendientes.md` |
| Puntero de arranque: leer `LEER-PRIMERO.md` antes de implementar | Texto largo de contexto de negocio → `SHARED_CONTEXT.md` |
| Patrones por carpeta (modo dual, design system, SSR) | Convenciones completas de código y auditorías → `CLAUDE.md` |
| Flujo solo-Cursor (backlog, coordinación, locks, push integrador) | Coordinación detallada humanos/Claude → `TASKS/coordinacion-cursor-claude-ia-venta.md` |
| Carril acotado por `globs` (ej. OpenAPI/MCP) | Planes por iniciativa, QA, informes → `TASKS/*.md` organizados por tema |

**Regla anti-duplicación:** si el mismo párrafo vive en `CLAUDE.md` o `SHARED_CONTEXT.md`, en `.mdc` dejar solo **bullets mínimos** o **“ver archivo §X”**.

---

## 2. Formato de archivos `.mdc`

- Frontmatter YAML: `description`, `alwaysApply` (`true`/`false`), y opcionalmente `globs` (lista separada por comas).
- **`alwaysApply: true`:** usar con moderación (seguridad, bootstrap, flujo Cursor backlog). Demasiadas reglas globales saturan el contexto.
- **`globs`:** para backend, frontend, views, openapi, etc. — la regla solo aplica cuando el trabajo toca esos paths.
- **Nombres:** prefijo numérico para orden (`00-`, `05-`, `10-`, …).

---

## 3. Índice de rules actuales (mantener al día al agregar o renombrar)

| Archivo | Alcance | Rol breve |
|---------|---------|-----------|
| `00-core-safety.mdc` | siempre | SPA/SSR, multi-tenant, secretos, fuente financiera |
| `05-leer-primero-bootstrap.mdc` | siempre | Leer `LEER-PRIMERO.md` antes de implementar / TASKS / migraciones |
| `06-producto-generico-sin-tenant-demo.mdc` | siempre | Demo no hardcodeada; **IDs en lógica/datos**, nombres solo UI (`audit-identificadores-vs-nombres-ui.md`) |
| `07-artifact-placement-repo-layout.mdc` | siempre | Dónde crear archivos: sin basura en raíz; `backend/`, `frontend/src/`, `backend/openapi/`, `backend/ai/`, `scripts/tooling|legacy`, `TASKS/tema/<id>/` |
| `10-backend-modo-dual.mdc` | `backend/**/*.js` | PostgreSQL + Firestore, `empresa_id`, mapeos |
| `20-frontend-design-system.mdc` | SPA + EJS | Tokens Tailwind, botones, no mezclar mundos |
| `30-ssr-ai-commerce.mdc` | rutas/vistas SSR | SEO, JSON-LD, tenant, IA-readability |
| `40-cursor-backlog-coordinacion.mdc` | siempre | Backlog producto, coordinación IA venta, locks |
| `45-canales-venta-solo-cursor.mdc` | openapi/MCP/carril venta | Solo Cursor en este carril; enlaza `TASKS/tema/SM-venta-ia/venta-ia.md` |
| `50-tasks-tablero-y-temas.mdc` | siempre | Flujo inicio: contexto → tema → acción; **actualizar `TASKS/tablero.md`** al crear/modificar/eliminar trabajo del tema; pestaña chat = nombre del tema |

---

## 4. Archivos globales del repo (no se mueven a `.cursor/rules`)

Estos archivos **permanecen en las rutas actuales**; las rules solo **enlazan** o **refuerzan** comportamiento.

| Archivo | Ubicación | Función |
|---------|-----------|---------|
| Entrada canónica de sesión | Raíz: `LEER-PRIMERO.md` | Orden de lectura y tabla de estándares → enlaces |
| Verdad arquitectónica | Raíz: `SHARED_CONTEXT.md` | Modo dual, multi-tenant, estado real del proyecto |
| Manual de implementación | Raíz: `CLAUDE.md` | Modularidad, auditorías, design system en detalle |
| Roadmap producto | `TASKS/backlog-producto-pendientes.md` | Qué construir y prioridades |
| Coordinación IA venta | `TASKS/coordinacion-cursor-claude-ia-venta.md` | Locks, handoff, bitácora |
| Detalle venta por IA / canales | `TASKS/tema/SM-venta-ia/venta-ia.md` | Cuando aplica el carril IA |
| Multi-agente / integrador | `TASKS/coordinacion-cursor-paralelo.md` | Bitácora, push, paralelos |

---

## 5. Tarjetas de trabajo (tablero) — vínculo con este repo

Las **tarjetas** no viven en `.cursor/rules`. Representan **temas de trabajo** (una tarjeta ≈ un hilo / rama / iniciativa). Opciones:

- **GitHub Projects** (recomendado si usás Issues/PRs): una tarjeta por tema; enlazar PR y rama.
- **Archivo en repo:** `TASKS/tablero.md` — vista markdown del tablero (columnas, tabla y plantilla de fila); enlazado desde `LEER-PRIMERO.md`.

Cada tarjeta debe poder enlazar: **rama**, **archivos clave** y, si aplica, **un subfolder** bajo `TASKS/themes/<tema>/` para notas del tema (sin sustituir al backlog global).

**Temas del proyecto** para crear tarjetas: derivarlos de **`TASKS/backlog-producto-pendientes.md`** (secciones/hitos) más **tracks transversales** que ya tengáis (ej. Google Hotels partner, marketplace, migración Postgres). No hace falta una tarjeta por cada `.md` suelto en `TASKS/` — agrupar por **iniciativa**.

---

## 6. Al añadir una rule nueva

1. ¿Es invariante global o solo para ciertos paths? → `alwaysApply` vs `globs`.
2. ¿Ya está explicado en `CLAUDE.md`? → En la `.mdc`, resumen o enlace; no duplicar capítulos.
3. Actualizar la **tabla del §3** en este README.
4. Si el cambio afecta la cadena de lectura, actualizar **`LEER-PRIMERO.md`**, no solo este directorio.

---

*Documento de política del equipo; mantener alineado con `LEER-PRIMERO.md`.*
