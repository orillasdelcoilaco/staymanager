# Leer primero — agentes Cursor (StayManager)

**Objetivo:** evitar solapamientos y lecturas duplicadas cuando varios agentes trabajan en paralelo sobre producto / release.

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

## 5. Git y GitHub — varios agentes Cursor en paralelo (no perder trabajo)

**Principio:** lo que está **commiteado y pusheado** a una rama en GitHub no se pierde por merges ajenos a `main`. Lo frágil es el trabajo **solo en el disco local** sin `git commit`.

### Reglas (cada agente / cada mejora)

1. **Una rama por tarea** desde `main` actualizado: `git fetch origin && git checkout main && git pull && git checkout -b feature/algo-descriptivo`.
2. **Commits pequeños y frecuentes** en esa rama; **`git push -u origin feature/...`** para que el trabajo exista en GitHub aunque falle el laptop.
3. **Antes de fusionar a `main`:** en la rama feature, `git fetch origin && git merge origin/main` (o `git rebase origin/main` si el equipo lo usa) para integrar lo que otros ya subieron y reducir conflictos.
4. **Merge a `main` solo por PR o merge explícito** (como el flujo de cotización IA). **Nunca** `git push --force` a `main`.
5. **Stash (`git stash`)** solo sirve en **esa** copia del repo para cambiar de rama sin commitear; **no sustituye** el push. Otros agentes en **otro clone** no ven tu stash.

### Si varios agentes usan el **mismo** directorio del repo

Git no está pensado para tres escritores concurrentes en la misma carpeta. Opciones:

- **Recomendado:** tres **clones** del repo (tres carpetas) o **`git worktree add ../staymanager-agente-b feature/nombre`** para cada agente con su rama.
- **Mínimo:** antes de que otro proceso toque Git, **commit + push** a una rama feature; coordinar quién hace `checkout main`.

### Resumen para el usuario

Las mejoras que «subimos a GitHub» deben ir **siempre** en ramas con commits propios y merge a `main` sin pisar el historial. Eso **no elimina** el código que otros agentes ya hayan **pusheado**; solo combina historiales. El riesgo es trabajo **no pusheado**: la solución es **push frecuente a ramas feature**.

*Última actualización: 2026-04-24 — §5 Git multi-agente; cierre 1.0.0 (A) + backlog §1.6 (B).*
