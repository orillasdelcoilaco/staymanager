# Reporte de Auditoría UI
**Generado:** 2026-05-07 22:05
**Archivos analizados:** 186
**Problemas encontrados:** 12 (alta: 0 / media: 5 / baja: 7)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Botón con clases Tailwind directas (sin .btn-*) | media | 5 |
| Color hexadecimal hardcodeado | baja | 7 |

---

## Detalle por categoría

### Botón con clases Tailwind directas (sin .btn-*) (5 ocurrencias)
**Sugerencia:** Usar btn-primary / btn-danger / btn-success / btn-outline  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | 321 | `class="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-success-100 text-success-700 border border-success-200"` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | 322 | `class="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-warning-100 text-warning-700 border border-warning-200"` |
| `frontend/src/views/comunicaciones.js` | 182 | `class="com-tab px-3 py-1.5 text-sm rounded-md font-medium bg-primary-100 text-primary-800"` |
| `frontend/src/views/normasAlojamiento.js` | 300 | `class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"` |
| `backend/views/propiedad.ejs` | 1190 | `class="lg:hidden text-sm font-semibold text-primary-700 border border-primary-200 bg-primary-50 px-3 py-2 rounded-xl hover:bg-primary-100 transition-colors"` |

### Color hexadecimal hardcodeado (7 ocurrencias)
**Sugerencia:** Usar tokens de color de Tailwind config  
**Severidad:** baja

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `backend/views/partials/marketplace-common-styles.ejs` | 12 | `#fff` |
| `backend/views/partials/marketplace-common-styles.ejs` | 42 | `#fff` |
| `backend/views/partials/marketplace-common-styles.ejs` | 53 | `#fff` |
| `backend/views/partials/marketplace-common-styles.ejs` | 64 | `#fff` |
| `backend/views/propiedad.ejs` | 63 | `#fff` |
| `backend/views/propiedad.ejs` | 64 | `#222` |
| `backend/views/propiedad.ejs` | 75 | `#fff` |

---

## Vistas con más problemas

| Archivo | Problemas |
|---------|----------|
| `backend/views/partials/marketplace-common-styles.ejs` | 4 |
| `backend/views/propiedad.ejs` | 4 |
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | 2 |
| `frontend/src/views/comunicaciones.js` | 1 |
| `frontend/src/views/normasAlojamiento.js` | 1 |

---
*Generado por scripts/tooling/audit-ui.js*
