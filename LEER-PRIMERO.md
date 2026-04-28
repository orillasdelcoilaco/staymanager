# LEER-PRIMERO.md — Antes de actuar en este repositorio

**Para ti (humano):** puedes decirle a cualquier agente **solo esto**:

> Antes de hacer algo, lee `LEER-PRIMERO.md` en la raíz del repo.

**Para el agente:** abre este archivo al inicio de la sesión en la que vayas a tocar código, `TASKS/`, migraciones o despliegue. No reemplaza el resto de la documentación: define **en qué orden** leerla y **cómo evitar pisar** a otro agente en los mismos archivos.

## Orden de lectura (obligatorio)

1. **`SHARED_CONTEXT.md`** — Estado real del proyecto: arquitectura, modo dual PostgreSQL/Firestore, multi-tenant, tablas y convenciones. Si hay conflicto con otro documento, **gana** este.
2. **`TASKS/coordinacion-cursor-claude-ia-venta.md`** — Como mínimo: **§2 Estado actual**, **§3** (locks), **§10** (varios agentes y el mismo `TASKS/*.md`). Si vas a editar `TASKS/backlog-producto-pendientes.md` u otro markdown compartido y §2 muestra **EN CURSO** por **otro** actor, **no** modifiques ese archivo hasta que el usuario lo coordine.
3. **`TASKS/backlog-producto-pendientes.md`** — Roadmap de producto cuando el trabajo afecte hitos, prioridades o cierres de tarea (después del paso 2 para respetar locks y filas EN CURSO).
4. **`CLAUDE.md`** — Si trabajas como **Claude Code** (CLI): rol, auditorías y handoff IA venta en paralelo con Cursor.

## Regla corta (multi-agente)

El archivo de **coordinación** (`TASKS/coordinacion-cursor-claude-ia-venta.md`) es quien indica **quién está moviendo** qué parte de `TASKS/`. El backlog dice **qué** hay que construir; no usemos dos sesiones escribiendo el mismo `.md` a la vez sin pasar por §2 / §10 / LOCK.

## Cursor

Las reglas en `.cursor/rules/` (seguridad, modo dual, frontend, backlog) se aplican **además** de lo anterior. La regla `40-cursor-backlog-coordinacion.mdc` detalla el flujo del backlog en Cursor.
