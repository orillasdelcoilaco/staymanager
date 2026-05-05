# Scripts legacy (raíz del repo)

Aquí viven **utilidades puntuales**: migraciones ya ejecutadas, diagnósticos de incidente, seeds manuales y pruebas ad hoc que **no** forman parte del flujo diario de auditoría ni de `npm run test:ci`.

## Convención

Desde la **raíz del repo**:

```bash
node scripts/legacy/<archivo>.js [argumentos]
```

Los paths relativos dentro de cada script suponen `__dirname` en `scripts/legacy/` (p. ej. `../../backend/`).

Scripts bajo **`backend/scripts/`** (no aquí) siguen documentados con `node backend/scripts/...` en sus cabeceras.

## Herramientas en `scripts/tooling/`

Auditorías, migración de colores del design system, monitor de créditos y hooks: ver `scripts/tooling/README-creditos.md` y los archivos en esa carpeta (`audit-*.js`, `migrate-colors.js`, `check-new-criticos.js`, etc.).
