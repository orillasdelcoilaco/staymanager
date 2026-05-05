# Una carpeta por tema — `TASKS/tema/<id>/`

Cada iniciativa con fila en **`TASKS/tablero.md`** tiene un directorio cuyo nombre es el **ID** (`SM-<slug>`), no el título largo.

## Formato de ID

- Prefijo **`SM-`** + **kebab-case** minúsculas, sin espacios ni tildes en el path.
- El **título legible** solo en `tablero.md` y en el `README.md` del tema.

## Fase de descubrimiento (antes de codificar)

Muchas sesiones empiezan con **conversación**: problema, opciones, iteración humano–agente, y recién después código. Para **no perder el hilo** sin inflar el repo:

| Enfoque | Veredicto |
|---------|-----------|
| Un **plan de acción por tema** (`plan-accion-<tema>.md` o `plan-accion-<slug>.md` en la raíz del ID) | **Sí** — es el sitio único del “por qué” y del “qué haremos”. |
| **Un archivo nuevo por cada iteración** de charla | **No** — genera ruido y nadie sabe cuál leer. |
| **Bitácora de interacciones** | **Sí, pero dentro del mismo plan** — sección al final (ver plantilla abajo), con viñetas **fechadas** por cada vuelta de planificación o decisión importante. |

**Cuándo crear o extender el plan:** si el tema va a durar **más de una sesión**, hay **varias soluciones posibles**, o el usuario/agente ya invirtió en **explorar alternativas**. Para un cambio trivial de una ruta o un typo, basta con **última nota** en `tablero.md` (y commit).

**Qué sigue siendo el índice operativo:** `TASKS/tablero.md` = **dónde está** cada tema y **estado**; el `plan-accion-*.md` = **contexto, decisiones y pasos** antes y durante la implementación.

### Plantilla mínima sugerida (`plan-accion-*.md`)

```markdown
# Plan de acción — <título corto>

## 1. Problema / contexto
(Qué duele, restricciones, enlaces a código o backlog §)

## 2. Opciones consideradas
| Opción | Pros | Contras | ¿Descartada? |
|--------|------|---------|--------------|

## 3. Enfoque elegido
(Resumen de la decisión actual; qué queda fuera de alcance)

## 4. Pasos de implementación
- [ ] …
- [ ] …

## 5. Bitácora de planificación (pre-código y durante)
- YYYY-MM-DD — Nota breve (qué se acordó, qué se descartó, siguiente duda).
```

La bitácora **no sustituye** al tablero: cuando una decisión **cambia el estado** del tema (bloqueo, listo, en curso), reflejarlo también en **`TASKS/tablero.md`**.

---

## Contenido: todo en la raíz del tema

**No** hay subcarpetas obligatorias (`test/`, `debug/`, etc. eran solo ilustración). Los archivos del tema —del tipo que sea— van **directamente** en `TASKS/tema/<id>/`:

- Convención de **nombre** por tipo de artefacto (como en el `TASKS/` tradicional, pero bajo el ID):  
  `audit-*.md`, `checklist-*.md`, `qa-*.md`, `guia-*.md`, `plan-accion-*.md`, `pending-*.md`, `completed-*.md`, notas sueltas, etc.
- **`README.md`** recomendado: qué es el tema, estado, enlaces a backlog § e índice de los archivos clave si el directorio crece.
- **Subcarpetas** solo si el equipo decide partir un proceso muy grande; no forma parte del estándar mínimo.

## Tablero y regla Cursor

- **`TASKS/tablero.md`**: columna **ID** y **Carpeta** = `tema/<id>`.
- **`.cursor/rules/50-tasks-tablero-y-temas.mdc`**: actualizar tablero + archivos bajo `tema/<id>/` al trabajar o cerrar.

## Migración desde `TASKS/*.md` en la raíz

Los documentos **canónicos** globales en la raíz de **`TASKS/`** incluyen `backlog-producto-pendientes.md`, `coordinacion-cursor-claude-ia-venta.md`, `coordinacion-cursor-paralelo.md`, `tablero.md`, … El roadmap **Venta por IA** no está en esa lista: vive en **`tema/SM-venta-ia/venta-ia.md`** (tablero **`SM-venta-ia`**); **`TASKS/venta-ia.md`** es solo puntero. La entrada de lectura **única** con nombre «LEER-PRIMERO» es **`LEER-PRIMERO.md`** en la **raíz** del repo.

**Oleada 2026-05-05:** ya viven bajo `tema/<id>/` los planes y QA ligados al tablero (release v1.0.0, Google partner/onboarding, estrategia post-partner + Beds24, heatmap QA, venta-IA QA/gemini, audit ids vs nombres). Enlaces en `LEER-PRIMERO`, `CLAUDE`, `SHARED_CONTEXT`, backlog y coordinación apuntan a las rutas nuevas.

**Oleada 2 (misma fecha):** planes SSR/SPA, fotos/galería, CRM/propiedades, IA, auditorías (incl. reportes generados por scripts), onboarding UX, migración Postgres, operación agentes (`pending`/`completed`/DoD/alertas). Mapeo archivo → carpeta: [`MIGRACION-oleada-2-mapeo.md`](MIGRACION-oleada-2-mapeo.md). Filas en [`tablero.md`](../tablero.md).

**Guías que estaban en `docs/`:** ahora bajo tema — índices Firestore en `SM-migracion-postgres/`; refactor y arquitectura v2 en `SM-auditoria-calidad/`; config GPT SuiteManager en `SM-venta-ia/`. Artefactos locales ignorados: carpeta **`local/`** (ver `local/README.md`).

Por tema, seguir trayendo el resto de `TASKS/*.md` con nombres prefijados y actualizar el [`tablero.md`](../tablero.md).
