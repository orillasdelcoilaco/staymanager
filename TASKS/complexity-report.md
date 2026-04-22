# Reporte de Complejidad y Modularidad
**Generado:** 2026-04-20 15:53
**Archivos analizados:** 289
**Críticos:** 5 | **Warnings:** 0

---

## Resumen

### 🔴 Críticos (5) — Requieren refactorización

| Archivo | Problema | Detalle |
|---------|---------|--------|
| `frontend/src/views/resenas.js` | function-size | función `afterRender` — 125 líneas (línea 290) |
| `backend/services/resenasService.js` | file-size | 792 líneas (límite crítico: 700) |
| `backend/services/resenasService.js` | function-size | función `generarResenasAutomaticas` — 143 líneas (línea 629) |
| `backend/services/resenasService.js` | too-many-exports | 17 funciones exportadas (límite crítico: 15) |
| `backend/routes/website.property.page.js` | function-size | función `renderPropiedadPublica` — 120 líneas (línea 68) |

---

## Plan de refactorización sugerido

> Orden de prioridad: atacar primero los archivos más grandes con más exports.

### 1. `backend/services/resenasService.js` 🔴
- **792 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `generarResenasAutomaticas` — 143 líneas (línea 629)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **17 funciones exportadas (límite crítico: 15)**
  - Agrupar responsabilidades en sub-módulos. Ej: service.read.js, service.write.js, service.calc.js

### 2. `frontend/src/views/resenas.js` 🔴
- **función `afterRender` — 125 líneas (línea 290)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 3. `backend/routes/website.property.page.js` 🔴
- **función `renderPropiedadPublica` — 120 líneas (línea 68)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

---

## Umbrales configurados

| Métrica | Warning | Crítico |
|---------|---------|--------|
| Líneas por archivo | >1000 | >700 |
| Líneas por función | >200 | >120 |
| Exports por archivo | >100 | >15 |

*Generado por scripts/audit-complexity.js*
