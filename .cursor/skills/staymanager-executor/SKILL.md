---
name: staymanager-executor
description: Ejecuta tareas de desarrollo en StayManager respetando separacion SPA/SSR, aislamiento multiempresa estricto y modo dual PostgreSQL/Firestore. Usar en cualquier cambio de backend, frontend, SSR, migraciones o refactors.
---

# StayManager Executor

## Objetivo

Aplicar cambios de forma segura y consistente con la arquitectura del proyecto.

## Invariantes del dominio (no negociables)

1. `SPA` y `SSR` son mundos separados.
2. Las empresas son totalmente independientes entre si.
3. La unica entidad compartida global entre empresas son clientes.
4. Nunca romper aislamiento multi-tenant.
5. Nunca sobrescribir `valores.valorHuesped`.

## Flujo operativo

1. Leer `LEER-PRIMERO.md` (raíz) y seguir su orden; como mínimo `SHARED_CONTEXT.md` y, si aplica, `CLAUDE.md`.
2. Clasificar el cambio: `SPA`, `SSR`, `backend core`, `migracion`, o mixto.
3. Implementar con alcance minimo y alta cohesion.
4. Validar reglas de tenant y modo dual (`pool` vs fallback).
5. Ejecutar auditorias:
   - `node scripts/audit-complexity-monitored.js`
   - `node scripts/audit-ui-monitored.js` (si toca frontend/UI)
6. Entregar resultado con:
   - cambios realizados
   - riesgos residuales
   - pruebas ejecutadas o pendientes

## Checklist de cierre

- [ ] Sin mezcla indebida SPA/SSR.
- [ ] Querys con filtro de empresa.
- [ ] Mapeo `snake_case -> camelCase` aplicado.
- [ ] Sin secretos ni hardcodeo sensible.
- [ ] Auditorias corridas segun alcance.
