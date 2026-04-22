# Definition of Done - StayManager

Checklist obligatorio para cerrar cualquier tarea de desarrollo.

## 1) Contexto y alcance

- [ ] Leidos `SHARED_CONTEXT.md` y `CLAUDE.md`.
- [ ] Alcance definido (`SPA`, `SSR`, backend, o mixto).
- [ ] Se respeta separacion de mundos: `SPA` y `SSR` no se mezclan.

## 2) Reglas de dominio

- [ ] Aislamiento multiempresa validado (sin cruces entre tenants).
- [ ] Unica entidad compartida global tratada explicitamente: clientes.
- [ ] Integridad financiera preservada (`valores.valorHuesped` no se sobrescribe).

## 3) Calidad tecnica

- [ ] SQL con filtro por `empresa_id` en todas las operaciones.
- [ ] Mapeo `snake_case -> camelCase` aplicado en servicios PG.
- [ ] Fallback dual PG/Firestore validado cuando aplique.

## 4) Auditorias y verificacion

- [ ] `node scripts/audit-complexity-monitored.js` ejecutado.
- [ ] `node scripts/audit-ui-monitored.js` ejecutado (si hay cambios frontend/UI).
- [ ] Smoke test del flujo modificado (ruta o caso principal).

## 5) Seguridad y entrega

- [ ] Sin secretos hardcodeados ni archivos sensibles comprometidos.
- [ ] Riesgos residuales documentados.
- [ ] Pendientes o pruebas no ejecutadas documentadas.
