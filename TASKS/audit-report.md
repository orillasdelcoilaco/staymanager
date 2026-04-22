# Reporte de Auditoría UI
**Generado:** 2026-04-22 02:47
**Archivos analizados:** 149
**Problemas encontrados:** 35 (alta: 1 / media: 2 / baja: 32)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Rojo hardcodeado (debería usar danger-*) | alta | 1 |
| Botón con clases Tailwind directas (sin .btn-*) | media | 2 |
| Color hexadecimal hardcodeado | baja | 32 |

---

## Detalle por categoría

### Rojo hardcodeado (debería usar danger-*) (1 ocurrencias)
**Sugerencia:** Usar bg-danger-600 / text-danger-600 / btn-danger  
**Severidad:** alta

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/views/resenas.js` | 95 | `text-red-700` |

### Botón con clases Tailwind directas (sin .btn-*) (2 ocurrencias)
**Sugerencia:** Usar btn-primary / btn-danger / btn-success / btn-outline  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/views/normasAlojamiento.js` | 300 | `class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"` |
| `backend/views/propiedad.ejs` | 1117 | `class="lg:hidden text-sm font-semibold text-primary-700 border border-primary-200 bg-primary-50 px-3 py-2 rounded-xl hover:bg-primary-100 transition-colors"` |

### Color hexadecimal hardcodeado (32 ocurrencias)
**Sugerencia:** Usar tokens de color de Tailwind config  
**Severidad:** baja

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `backend/views/marketplace/index.ejs` | 77 | `#f8f8f8` |
| `backend/views/marketplace/index.ejs` | 78 | `#fff` |
| `backend/views/marketplace/index.ejs` | 78 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 79 | `#4f46e5` |
| `backend/views/marketplace/index.ejs` | 80 | `#111` |
| `backend/views/marketplace/index.ejs` | 83 | `#fff` |
| `backend/views/marketplace/index.ejs` | 83 | `#d1d5db` |
| `backend/views/marketplace/index.ejs` | 92 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 93 | `#111` |
| `backend/views/marketplace/index.ejs` | 94 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 95 | `#9ca3af` |
| `backend/views/marketplace/index.ejs` | 97 | `#4f46e5` |
| `backend/views/marketplace/index.ejs` | 97 | `#fff` |
| `backend/views/marketplace/index.ejs` | 102 | `#4338ca` |
| `backend/views/marketplace/index.ejs` | 104 | `#fff` |
| `backend/views/marketplace/index.ejs` | 110 | `#e5e7eb` |
| `backend/views/marketplace/index.ejs` | 113 | `#e0e7ff` |
| `backend/views/marketplace/index.ejs` | 113 | `#f0f4ff` |
| `backend/views/marketplace/index.ejs` | 113 | `#a5b4fc` |
| `backend/views/marketplace/index.ejs` | 114 | `#fff` |
| `backend/views/marketplace/index.ejs` | 114 | `#111` |
| `backend/views/marketplace/index.ejs` | 116 | `#111` |
| `backend/views/marketplace/index.ejs` | 117 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 118 | `#111` |
| `backend/views/marketplace/index.ejs` | 119 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 120 | `#111` |
| `backend/views/marketplace/index.ejs` | 122 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 123 | `#111` |
| `backend/views/marketplace/index.ejs` | 274 | `#111` |
| `backend/views/propiedad.ejs` | 60 | `#fff` |
| `backend/views/propiedad.ejs` | 61 | `#222` |
| `backend/views/propiedad.ejs` | 72 | `#fff` |

---

## Vistas con más problemas

| Archivo | Problemas |
|---------|----------|
| `backend/views/marketplace/index.ejs` | 29 |
| `backend/views/propiedad.ejs` | 4 |
| `frontend/src/views/normasAlojamiento.js` | 1 |
| `frontend/src/views/resenas.js` | 1 |

---
*Generado por scripts/audit-ui.js*
