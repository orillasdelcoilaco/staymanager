# Reporte de Complejidad y Modularidad
**Generado:** 2026-04-24 18:17
**Archivos analizados:** 317
**Críticos:** 28 | **Warnings:** 0

---

## Resumen

### 🔴 Críticos (28) — Requieren refactorización

| Archivo | Problema | Detalle |
|---------|---------|--------|
| `frontend/src/views/components/configurarWebPublica/webPublica.general.unified.lineasExtraRows.js` | function-size | función `_createRowElement` — 127 líneas (línea 73) |
| `frontend/src/views/components/configurarWebPublica/webPublica.paso1.identidad.js` | file-size | 734 líneas (límite crítico: 700) |
| `frontend/src/views/components/crm/crm.pipeline.js` | function-size | función `setupPipeline` — 126 líneas (línea 94) |
| `frontend/src/views/components/gestionarTarifas/matriz.js` | function-size | función `renderMatriz` — 183 líneas (línea 47) |
| `frontend/src/views/components/gestionarTarifas/matriz.js` | function-size | función `_setupMatrizEvents` — 178 líneas (línea 273) |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | function-size | función `renderMensajeModal` — 140 líneas (línea 142) |
| `frontend/src/views/comunicaciones.js` | function-size | función `render` — 122 líneas (línea 167) |
| `frontend/src/views/comunicaciones.js` | function-size | función `afterRender` — 203 líneas (línea 459) |
| `frontend/src/views/normasAlojamiento.js` | function-size | función `renderForm` — 153 líneas (línea 155) |
| `frontend/src/views/resenas.js` | function-size | función `afterRender` — 125 líneas (línea 290) |
| `backend/services/aiContentService.js` | file-size | 785 líneas (límite crítico: 700) |
| `backend/services/aiContentService.js` | too-many-exports | 17 funciones exportadas (límite crítico: 15) |
| `backend/services/buildContextService.js` | function-size | función `getBuildContext` — 121 líneas (línea 122) |
| `backend/services/comunicacionesRetryService.js` | function-size | función `reintentarComunicacionEmail` — 197 líneas (línea 213) |
| `backend/services/empresaService.js` | function-size | función `actualizarDetallesEmpresa` — 150 líneas (línea 28) |
| `backend/services/gestionPropuestas.email.js` | function-size | función `enviarEmailReservaConfirmada` — 130 líneas (línea 130) |
| `backend/services/plantillasService.js` | too-many-exports | 20 funciones exportadas (límite crítico: 15) |
| `backend/services/publicWebsiteService.js` | file-size | 1115 líneas (límite crítico: 700) |
| `backend/services/publicWebsiteService.js` | function-size | función `obtenerMasAlojamientosParaFichaSSR` — 205 líneas (línea 231) |
| `backend/services/publicWebsiteService.js` | function-size | función `verificarReconciliacionPrecioReservaPublica` — 138 líneas (línea 592) |
| `backend/services/publicWebsiteService.js` | function-size | función `crearReservaPublica` — 156 líneas (línea 835) |
| `backend/services/resenasService.js` | file-size | 888 líneas (límite crítico: 700) |
| `backend/services/resenasService.js` | function-size | función `generarResenasAutomaticas` — 143 líneas (línea 723) |
| `backend/services/resenasService.js` | too-many-exports | 19 funciones exportadas (límite crítico: 15) |
| `backend/services/transactionalEmailService.js` | too-many-exports | 16 funciones exportadas (límite crítico: 15) |
| `backend/routes/website.booking.js` | function-size | función `registerBookingRoutes` — 167 líneas (línea 11) |
| `backend/routes/website.home.helpers.js` | function-size | función `loadHomeSearchBundle` — 126 líneas (línea 8) |
| `backend/routes/website.property.page.js` | function-size | función `renderPropiedadPublica` — 189 líneas (línea 76) |

---

## Plan de refactorización sugerido

> Orden de prioridad: atacar primero los archivos más grandes con más exports.

### 1. `backend/services/publicWebsiteService.js` 🔴
- **1115 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `obtenerMasAlojamientosParaFichaSSR` — 205 líneas (línea 231)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `verificarReconciliacionPrecioReservaPublica` — 138 líneas (línea 592)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `crearReservaPublica` — 156 líneas (línea 835)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 2. `backend/services/resenasService.js` 🔴
- **888 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `generarResenasAutomaticas` — 143 líneas (línea 723)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **19 funciones exportadas (límite crítico: 15)**
  - Agrupar responsabilidades en sub-módulos. Ej: service.read.js, service.write.js, service.calc.js

### 3. `backend/services/aiContentService.js` 🔴
- **785 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **17 funciones exportadas (límite crítico: 15)**
  - Agrupar responsabilidades en sub-módulos. Ej: service.read.js, service.write.js, service.calc.js

### 4. `frontend/src/views/components/configurarWebPublica/webPublica.paso1.identidad.js` 🔴
- **734 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.

### 5. `frontend/src/views/components/configurarWebPublica/webPublica.general.unified.lineasExtraRows.js` 🔴
- **función `_createRowElement` — 127 líneas (línea 73)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 6. `frontend/src/views/components/crm/crm.pipeline.js` 🔴
- **función `setupPipeline` — 126 líneas (línea 94)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 7. `frontend/src/views/components/gestionarTarifas/matriz.js` 🔴
- **función `renderMatriz` — 183 líneas (línea 47)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `_setupMatrizEvents` — 178 líneas (línea 273)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 8. `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` 🔴
- **función `renderMensajeModal` — 140 líneas (línea 142)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 9. `frontend/src/views/comunicaciones.js` 🔴
- **función `render` — 122 líneas (línea 167)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `afterRender` — 203 líneas (línea 459)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 10. `frontend/src/views/normasAlojamiento.js` 🔴
- **función `renderForm` — 153 líneas (línea 155)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

---

## Umbrales configurados

| Métrica | Warning | Crítico |
|---------|---------|--------|
| Líneas por archivo | >1000 | >700 |
| Líneas por función | >200 | >120 |
| Exports por archivo | >100 | >15 |

*Generado por scripts/audit-complexity.js*
