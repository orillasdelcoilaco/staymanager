# Scripts en la raíz del repo

- **`tooling/`** — Auditorías UI/complejidad, migración de colores al design system, monitor de créditos, hooks y configuración. Documentación: `tooling/README-creditos.md`.
- **`legacy/`** — Scripts puntuales (migraciones ya ejecutadas, diagnósticos, seeds manuales). Ver `legacy/README.md`.

Desde la raíz del repositorio, los comandos habituales son:

```bash
node scripts/tooling/audit-ui-monitored.js
node scripts/tooling/audit-complexity-monitored.js
node scripts/tooling/monitor-creditos.js reporte
```
