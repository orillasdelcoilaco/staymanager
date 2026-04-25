# Leer primero — agentes Cursor (StayManager)

**Objetivo:** evitar solapamientos cuando varios agentes Cursor trabajan en **paralelo en local**. La sincronía entre agentes es este archivo (**`leer-primero.md`**) + el backlog; **subir a GitHub** lo concentra por ahora **una sola sesión/agente** (ver §5.1).

---

## 1. Orden de lectura (siempre)

1. **Este archivo** (`TASKS/leer-primero.md`) — rol y límites.
2. **`TASKS/plan-release-1.0.0.md`** — qué cuenta como «listo para tag v1.0.0» (CI, smoke manual §2, qué queda fuera).
3. **`TASKS/backlog-producto-pendientes.md`** — hitos vivos, §4.3, §5 orden sugerido, referencias §6.

Reglas de proyecto útiles: `CLAUDE.md`, `.cursor/rules/00-core-safety.mdc`, skill `.cursor/skills/staymanager-executor/SKILL.md` si tocan back/SSR/SPA.

---

## 2. Reparto acordado (sesión coordinada)

| Rol | Responsable | Alcance | No hacer |
|-----|-------------|---------|----------|
| **Punto 1 — Cierre 1.0.0** | Agente A | Completar checklist del **`plan-release-1.0.0.md` §2–§3**: `npm run test:ci` verde, opcional `npm run test:ssr` con SSR arriba, smoke manual staging (checkboxes §2), alinear texto del plan con realidad, preparar notas mínimas para tag `v1.0.0`. | No abrir §4.3 D ni integraciones pasarela sin acuerdo. |
| **Punto 2 — Backlog siguiente** | Agente B | Atacar **§5 del backlog, ítem 2**: *«Preferencias y copy del motor (§1.6)»* — asuntos/textos fijos según locale, ampliar `correosAutomaticosCategorias` si producto lo define, coherencia con `idiomaPorDefecto` / `transactionalEmailFallbackSubjects` donde aplique. Documentar en `backlog-producto-pendientes.md` lo hecho. | No bloquear el merge del Agente A por refactors masivos en el mismo PR si trabajan rama distinta. |

Si producto prioriza otra pieza del backlog (p. ej. **§2.3** widget con fechas o **§1.4** iCal en PG), el **usuario** lo indica y se actualiza la tabla de arriba en un commit o en el chat de coordinación.

---

## 3. Al terminar (los dos roles)

Si **no** eres quien hace push (§5.1), añade al menos una fila en **§5.3** para que el integrador sepa qué subir.

1. Actualizar **`TASKS/backlog-producto-pendientes.md`** (pie «Última actualización» + filas tocadas).
2. Dejar en **`TASKS/plan-release-1.0.0.md`** los checkboxes §2 marcados si el smoke se ejecutó.
3. **Resumen corto** en **`TASKS/coordinacion-cursor-claude-ia-venta.md` §11** (plantilla **11.1**): smoke §2 sí/no, tag sí/no, estado Agente B, próxima asignación §5 o §4.3 D.

---

## 4. Comandos rápidos (raíz del repo)

```bash
npm run test:ci
npm run test:ssr
```

---

## 5. Git y GitHub — modelo actual (varios agentes locales + un integrador)

### 5.1 Quién hace `git push` (pruebas ChatGPT / Render)

**Por ahora:** solo **una sesión Cursor designada** (la que integra con el usuario para **Render + ChatGPT**) ejecuta **`git commit` + `git push`** hacia `origin` y los **merge a `main`** cuando toque publicar.

- **El resto de agentes Cursor** trabajan en **local**: editan código y **documentan** en este archivo (§5.2); **no** hacen `git push` ni merge a `main` salvo que el **usuario** lo indique explícitamente.
- Motivo: un solo flujo hacia GitHub evita conflictos de credenciales, pushes cruzados y despliegues en Render duplicados o incoherentes durante las pruebas con ChatGPT.

### 5.2 Sincronía entre agentes (sin GitHub)

1. **Al abrir tarea:** leer este `leer-primero.md` (tabla §2 si aplica) y **`TASKS/backlog-producto-pendientes.md`**.
2. **Al avanzar o pausar:** añadir una fila en **§5.3** (bitácora) y, si aplica, una línea en **`TASKS/coordinacion-cursor-claude-ia-venta.md` §6** o §11.
3. **Archivos compartidos** (`TASKS/*.md`, reglas `.cursor/`): antes de editar, revisar la última entrada de §5.3; si otro agente está en la misma zona, coordinar por el usuario o dejar **LOCK** breve en texto en §5.3.

### 5.3 Bitácora — listo para integrar (rellenan los agentes locales)

_Formato sugerido (más reciente arriba). Quien hace push lee esto antes de commitear._

| Fecha (ISO) | Agente / chat | Área | Estado | Archivos o notas (sin secretos) |
|---------------|----------------|------|--------|-----------------------------------|
| *Plantilla* | *nombre del chat* | *p. ej. IA venta / SSR* | LISTO_PUSH o EN_CURSO | Rutas tocadas; avisar si hace falta pull antes de integrar. |

### 5.4 Reglas técnicas (quien integre push)

1. Antes de push: **`git pull origin main`** (o fetch + merge) para no pisar lo ya en remoto.
2. **Nunca** `git push --force` a **`main`**.
3. Preferible **rama `feature/...`** con commits claros y merge a `main`; si se commitea directo en `main`, mantener commits pequeños y mensaje descriptivo.
4. Tras integrar cambios de otros desde el disco: revisar **§5.3** y `git status` para no incluir archivos que no correspondan (`.env`, binarios, etc.).

*Última actualización: 2026-04-24 — §5 modelo integrador + leer-primero como sync; cierre 1.0.0 (A) + backlog §1.6 (B).*
