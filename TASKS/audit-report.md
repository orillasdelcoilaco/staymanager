# Reporte de Auditoría UI
**Generado:** 2026-04-28 22:23
**Archivos analizados:** 165
**Problemas encontrados:** 34 (alta: 0 / media: 5 / baja: 29)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Botón con clases Tailwind directas (sin .btn-*) | media | 5 |
| Color hexadecimal hardcodeado | baja | 29 |

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
| `backend/views/propiedad.ejs` | 1149 | `class="lg:hidden text-sm font-semibold text-primary-700 border border-primary-200 bg-primary-50 px-3 py-2 rounded-xl hover:bg-primary-100 transition-colors"` |

### Color hexadecimal hardcodeado (29 ocurrencias)
**Sugerencia:** Usar tokens de color de Tailwind config  
**Severidad:** baja

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `backend/views/marketplace/index.ejs` | 82 | `#f8f8f8` |
| `backend/views/marketplace/index.ejs` | 83 | `#fff` |
| `backend/views/marketplace/index.ejs` | 83 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 87 | `#fff` |
| `backend/views/marketplace/index.ejs` | 87 | `#d1d5db` |
| `backend/views/marketplace/index.ejs` | 96 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 97 | `#111` |
| `backend/views/marketplace/index.ejs` | 98 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 99 | `#9ca3af` |
| `backend/views/marketplace/index.ejs` | 107 | `#fff` |
| `backend/views/marketplace/index.ejs` | 113 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 116 | `#e0e7ff` |
| `backend/views/marketplace/index.ejs` | 116 | `#f0f4ff` |
| `backend/views/marketplace/index.ejs` | 116 | `#a5b4fc` |
| `backend/views/marketplace/index.ejs` | 117 | `#fff` |
| `backend/views/marketplace/index.ejs` | 117 | `#111` |
| `backend/views/marketplace/index.ejs` | 118 | `#fff7ed` |
| `backend/views/marketplace/index.ejs` | 118 | `#9a3412` |
| `backend/views/marketplace/index.ejs` | 118 | `#fdba74` |
| `backend/views/marketplace/index.ejs` | 120 | `#111` |
| `backend/views/marketplace/index.ejs` | 121 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 122 | `#111` |
| `backend/views/marketplace/index.ejs` | 123 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 124 | `#111` |
| `backend/views/marketplace/index.ejs` | 126 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 127 | `#111` |
| `backend/views/propiedad.ejs` | 61 | `#fff` |
| `backend/views/propiedad.ejs` | 62 | `#222` |
| `backend/views/propiedad.ejs` | 73 | `#fff` |

---

## Vistas con más problemas

| Archivo | Problemas |
|---------|----------|
| `backend/views/marketplace/index.ejs` | 26 |
| `backend/views/propiedad.ejs` | 4 |
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | 2 |
| `frontend/src/views/comunicaciones.js` | 1 |
| `frontend/src/views/normasAlojamiento.js` | 1 |

---
*Generado por scripts/audit-ui.js*
