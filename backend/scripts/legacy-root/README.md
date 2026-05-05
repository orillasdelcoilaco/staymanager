# Scripts migrados desde la raíz de `backend/`

Son utilidades puntuales (debug, auditoría, diagnósticos por propiedad, tests manuales). **No** forman parte del servidor: el arranque sigue siendo `backend/index.js`.

## Cómo ejecutarlos

Desde la **raíz del repo** (recomendado):

```bash
node backend/scripts/legacy-root/nombre-del-script.js
```

Los `require` apuntan a `backend/db`, `backend/services`, etc. (ruta relativa `../../...`). Los que usan Firebase suelen leer `backend/serviceAccountKey.json`.

Variables de entorno: la mayoría cargan `backend/.env` con rutas ajustadas al subdirectorio.

## Fixtures

`fixtures/property_detail_seeded.json` — datos de ejemplo para `extract_images.js` (si no está, generá uno o copiá desde backup).

## Scripts desde `backend/backend/` (anidación accidental)

Diagnósticos Firestore sobre capacidad / categorías / «individual» en nombres:

- `buscar-elementos-comedor.js`, `verificar-capacidad-cero.js`, `buscar-individuales.js` — leen `backend/serviceAccountKey.json` vía `require('../../serviceAccountKey.json')`.
- `test-correccion-capacidad.js` — prueba local de la lógica `calcularCapacidad` (sin Firebase).

## Historial

Estos archivos estaban sueltos en `backend/` o en `backend/backend/`; se agruparon aquí para dejar la raíz del backend ordenada.
