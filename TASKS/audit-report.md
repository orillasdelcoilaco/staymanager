# Reporte de Auditoría UI
**Generado:** 2026-04-24 18:55
**Archivos analizados:** 157
**Problemas encontrados:** 37 (alta: 0 / media: 2 / baja: 35)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Botón con clases Tailwind directas (sin .btn-*) | media | 2 |
| Color hexadecimal hardcodeado | baja | 35 |

---

## Detalle por categoría

### Botón con clases Tailwind directas (sin .btn-*) (2 ocurrencias)
**Sugerencia:** Usar btn-primary / btn-danger / btn-success / btn-outline  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/views/comunicaciones.js` | 174 | `class="com-tab px-3 py-1.5 text-sm rounded-md font-medium bg-primary-100 text-primary-800"` |
| `frontend/src/views/normasAlojamiento.js` | 300 | `class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"` |

### Color hexadecimal hardcodeado (35 ocurrencias)
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
| `backend/views/marketplace/index.ejs` | 115 | `#fff7ed` |
| `backend/views/marketplace/index.ejs` | 115 | `#9a3412` |
| `backend/views/marketplace/index.ejs` | 115 | `#fdba74` |
| `backend/views/marketplace/index.ejs` | 117 | `#111` |
| `backend/views/marketplace/index.ejs` | 118 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 119 | `#111` |
| `backend/views/marketplace/index.ejs` | 120 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 121 | `#111` |
| `backend/views/marketplace/index.ejs` | 123 | `#6b7280` |
| `backend/views/marketplace/index.ejs` | 124 | `#111` |
| `backend/views/marketplace/index.ejs` | 281 | `#111` |
| `backend/views/propiedad.ejs` | 64 | `#fff` |
| `backend/views/propiedad.ejs` | 65 | `#222` |
| `backend/views/propiedad.ejs` | 76 | `#fff` |

---

## Vistas con más problemas

| Archivo | Problemas |
|---------|----------|
| `backend/views/marketplace/index.ejs` | 32 |
| `backend/views/propiedad.ejs` | 3 |
| `frontend/src/views/comunicaciones.js` | 1 |
| `frontend/src/views/normasAlojamiento.js` | 1 |

---
*Generado por scripts/audit-ui.js*
