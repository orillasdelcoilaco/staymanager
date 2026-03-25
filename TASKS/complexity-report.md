# Reporte de Complejidad y Modularidad
**Generado:** 2026-03-24 19:08
**Archivos analizados:** 208
**Críticos:** 32 | **Warnings:** 130

---

## Resumen

### 🔴 Críticos (32) — Requieren refactorización

| Archivo | Problema | Detalle |
|---------|---------|--------|
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | function-size | función `renderPropuestaLayout` — 136 líneas (línea 73) |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | file-size | 762 líneas (límite crítico: 700) |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | function-size | función `renderWizardStep` — 153 líneas (línea 104) |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | function-size | función `openGalleryPicker` — 149 líneas (línea 441) |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | function-size | función `renderGeneral` — 145 líneas (línea 13) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | file-size | 873 líneas (límite crítico: 700) |
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | function-size | función `abrirModalVer` — 231 líneas (línea 12) |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | function-size | función `renderWizardModal` — 155 líneas (línea 10) |
| `frontend/src/views/generadorPresupuestos.js` | function-size | función `afterRender` — 139 líneas (línea 267) |
| `frontend/src/views/gestionarPropuestas.js` | function-size | función `handleTableClick` — 175 líneas (línea 92) |
| `frontend/src/views/gestionarReservas.js` | function-size | función `render` — 199 líneas (línea 26) |
| `frontend/src/views/gestionarTiposElemento.js` | function-size | función `afterRender` — 170 líneas (línea 290) |
| `frontend/src/views/utils.PASO0.js` | file-size | 726 líneas (límite crítico: 700) |
| `frontend/src/views/utils.PASO0.js` | too-many-exports | 18 funciones exportadas (límite crítico: 15) |
| `backend/services/analisisFinancieroService.js` | function-size | función `actualizarValoresGrupo` — 160 líneas (línea 9) |
| `backend/services/empresaImporterService.js` | file-size | 996 líneas (límite crítico: 700) |
| `backend/services/empresaImporterService.js` | function-size | función `createEmpresaFromImport` — 487 líneas (línea 462) |
| `backend/services/gestionPropuestasService.js` | file-size | 810 líneas (límite crítico: 700) |
| `backend/services/gestionPropuestasService.js` | function-size | función `guardarOActualizarPropuesta` — 201 líneas (línea 13) |
| `backend/services/gestionPropuestasService.js` | function-size | función `enviarEmailReservaConfirmada` — 122 líneas (línea 316) |
| `backend/services/gestionService.js` | function-size | función `getReservasPendientes` — 217 líneas (línea 16) |
| `backend/services/kpiService.js` | function-size | función `calculateKPIs` — 218 líneas (línea 9) |
| `backend/services/mensajeService.js` | function-size | función `generarTextoPropuesta` — 183 líneas (línea 50) |
| `backend/services/mensajeService.js` | function-size | función `generarTextoPresupuesto` — 134 líneas (línea 234) |
| `backend/services/presupuestosService.js` | function-size | función `generarPresupuesto` — 127 líneas (línea 25) |
| `backend/services/reservasService.js` | function-size | función `actualizarReservaManualmente` — 131 líneas (línea 80) |
| `backend/services/reservasService.js` | function-size | función `obtenerReservaPorId` — 159 líneas (línea 256) |
| `backend/services/reservasService.js` | function-size | función `eliminarGrupoReservasCascada` — 128 líneas (línea 504) |
| `backend/services/sincronizacionService.js` | function-size | función `procesarArchivoReservas` — 200 líneas (línea 272) |
| `backend/services/utils/calculoValoresService.js` | function-size | función `calculatePrice` — 144 líneas (línea 156) |
| `backend/services/webImporterService.js` | file-size | 726 líneas (límite crítico: 700) |
| `backend/services/webImporterService.js` | function-size | función `analyzeWebsite` — 189 líneas (línea 419) |

### 🟡 Warnings (130) — Monitorear

| Archivo | Problema | Detalle |
|---------|---------|--------|
| `frontend/src/api.js` | function-size | función `fetchAPI` — 80 líneas (línea 44) |
| `frontend/src/router.js` | function-size | función `renderMenu` — 62 líneas (línea 200) |
| `frontend/src/views/components/agregarPropuesta/propuesta.handlers.js` | file-size | 450 líneas (límite warning: 400) |
| `frontend/src/views/components/agregarPropuesta/propuesta.handlers.js` | function-size | función `runSearch` — 74 líneas (línea 122) |
| `frontend/src/views/components/agregarPropuesta/propuesta.handlers.js` | function-size | función `handleGuardarPropuesta` — 103 líneas (línea 235) |
| `frontend/src/views/components/agregarPropuesta/propuesta.handlers.js` | function-size | función `handleCargarPropuesta` — 84 líneas (línea 367) |
| `frontend/src/views/components/agregarPropuesta/propuesta.handlers.js` | too-many-exports | 12 funciones exportadas (límite warning: 8) |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | function-size | función `updateSummary` — 86 líneas (línea 9) |
| `frontend/src/views/components/calendario/calendario.gantt.js` | function-size | función `renderGantt` — 111 líneas (línea 41) |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | function-size | función `renderGaleria` — 65 líneas (línea 295) |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | function-size | función `setupGaleriaEvents` — 73 líneas (línea 591) |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | file-size | 412 líneas (límite warning: 400) |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | function-size | función `setupGeneralEvents` — 100 líneas (línea 159) |
| `frontend/src/views/components/dashboard/charts.js` | function-size | función `renderCharts` — 106 líneas (línea 10) |
| `frontend/src/views/components/estadosStore.js` | too-many-exports | 10 funciones exportadas (límite warning: 8) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `actualizarContadores` — 110 líneas (línea 220) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `normalize` — 86 líneas (línea 225) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `handleAgregarComponente` — 72 líneas (línea 361) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `handleGenerarEstructuraIA` — 100 líneas (línea 434) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `renderModalAlojamiento` — 95 líneas (línea 597) |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | function-size | función `abrirModalAlojamiento` — 115 líneas (línea 693) |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | function-size | función `renderCheckboxList` — 60 líneas (línea 186) |
| `frontend/src/views/components/gestionarCanales/canales.modals.js` | function-size | función `renderModalCanal` — 71 líneas (línea 7) |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | function-size | función `setupModalCliente` — 85 líneas (línea 184) |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | too-many-exports | 8 funciones exportadas (límite warning: 8) |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | function-size | función `renderTablaTipos` — 96 líneas (línea 3) |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | file-size | 598 líneas (límite warning: 400) |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | function-size | función `handleAnalizar` — 60 líneas (línea 221) |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | function-size | función `renderTabContent` — 68 líneas (línea 7) |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | function-size | función `renderSimuladorVentaDirecta` — 91 líneas (línea 76) |
| `frontend/src/views/components/gestionDiaria/modals/documentoModal.js` | function-size | función `renderDocumentoModal` — 68 líneas (línea 85) |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | function-size | función `generarMensajePreview` — 62 líneas (línea 12) |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | function-size | función `renderMensajeModal` — 77 líneas (línea 126) |
| `frontend/src/views/components/ubicacionWidget.js` | function-size | función `renderUbicacionWidget` — 67 líneas (línea 45) |
| `frontend/src/views/conversionAlojamientos.js` | function-size | función `render` — 61 líneas (línea 63) |
| `frontend/src/views/crmPromociones.js` | function-size | función `generarCampana` — 75 líneas (línea 49) |
| `frontend/src/views/crmPromociones.js` | function-size | función `render` — 74 líneas (línea 125) |
| `frontend/src/views/crmPromociones.js` | function-size | función `afterRender` — 75 líneas (línea 200) |
| `frontend/src/views/dashboard.js` | function-size | función `render` — 107 líneas (línea 96) |
| `frontend/src/views/dashboard.js` | function-size | función `afterRender` — 70 líneas (línea 204) |
| `frontend/src/views/empresa.js` | function-size | función `renderFormulario` — 68 líneas (línea 124) |
| `frontend/src/views/galeriaPropiedad.js` | function-size | función `bindGaleria` — 77 líneas (línea 228) |
| `frontend/src/views/generadorPresupuestos.js` | file-size | 405 líneas (límite warning: 400) |
| `frontend/src/views/generadorPresupuestos.js` | function-size | función `render` — 82 líneas (línea 182) |
| `frontend/src/views/generarReportes.js` | function-size | función `afterRender` — 74 líneas (línea 82) |
| `frontend/src/views/gestionarAlojamientos.js` | function-size | función `afterRender` — 81 líneas (línea 69) |
| `frontend/src/views/gestionarClientes.js` | function-size | función `renderCards` — 73 líneas (línea 25) |
| `frontend/src/views/gestionarClientes.js` | function-size | función `render` — 67 líneas (línea 120) |
| `frontend/src/views/gestionarComentarios.js` | function-size | función `render` — 92 líneas (línea 16) |
| `frontend/src/views/gestionarDolar.js` | function-size | función `render` — 67 líneas (línea 84) |
| `frontend/src/views/gestionarDolar.js` | function-size | función `afterRender` — 72 líneas (línea 152) |
| `frontend/src/views/gestionarReservas.js` | file-size | 467 líneas (límite warning: 400) |
| `frontend/src/views/gestionarReservas.js` | function-size | función `afterRender` — 114 líneas (línea 226) |
| `frontend/src/views/gestionarTarifas.js` | function-size | función `render` — 103 líneas (línea 21) |
| `frontend/src/views/gestionarTiposComponente.js` | function-size | función `afterRender` — 96 líneas (línea 52) |
| `frontend/src/views/gestionarTiposElemento.js` | file-size | 460 líneas (límite warning: 400) |
| `frontend/src/views/gestionarTiposElemento.js` | function-size | función `renderTabla` — 99 líneas (línea 25) |
| `frontend/src/views/gestionarTiposElemento.js` | function-size | función `render` — 112 líneas (línea 177) |
| `frontend/src/views/gestionDiaria.js` | function-size | función `afterRender` — 84 líneas (línea 175) |
| `frontend/src/views/importadorHistorico.js` | function-size | función `render` — 60 líneas (línea 11) |
| `frontend/src/views/importadorMagico.js` | file-size | 636 líneas (límite warning: 400) |
| `frontend/src/views/importadorMagico.js` | function-size | función `renderStep1` — 68 líneas (línea 144) |
| `frontend/src/views/importadorMagico.js` | function-size | función `renderStep2` — 78 líneas (línea 256) |
| `frontend/src/views/importadorMagico.js` | function-size | función `renderStep4` — 70 líneas (línea 427) |
| `frontend/src/views/importadorMagico.js` | function-size | función `handleCreate` — 60 líneas (línea 498) |
| `frontend/src/views/login.js` | function-size | función `renderLogin` — 96 líneas (línea 5) |
| `frontend/src/views/mapeoReportes.js` | function-size | función `render` — 85 líneas (línea 191) |
| `frontend/src/views/mapeosCentrales.js` | file-size | 552 líneas (límite warning: 400) |
| `frontend/src/views/mapeosCentrales.js` | function-size | función `render` — 94 líneas (línea 41) |
| `frontend/src/views/mapeosCentrales.js` | function-size | función `afterRender` — 99 líneas (línea 216) |
| `frontend/src/views/mapeosCentrales.js` | function-size | función `guardarMapeo` — 65 líneas (línea 474) |
| `frontend/src/views/perfilCliente.js` | function-size | función `render` — 113 líneas (línea 94) |
| `frontend/src/views/sincronizarCalendarios.js` | function-size | función `afterRender` — 67 líneas (línea 96) |
| `frontend/src/views/utils.PASO0.js` | function-size | función `renderSelectionUI` — 70 líneas (línea 117) |
| `frontend/src/views/utils.PASO0.js` | function-size | función `updateSummary` — 103 líneas (línea 232) |
| `frontend/src/views/utils.PASO0.js` | function-size | función `runSearch` — 77 líneas (línea 354) |
| `frontend/src/views/utils.PASO0.js` | function-size | función `handleGuardarPropuesta` — 99 líneas (línea 458) |
| `frontend/src/views/utils.PASO0.js` | function-size | función `handleCargarPropuesta` — 90 líneas (línea 596) |
| `backend/services/ai/filters.js` | function-size | función `checkAvailability` — 81 líneas (línea 15) |
| `backend/services/ai/intention.js` | function-size | función `detectIntention` — 72 líneas (línea 25) |
| `backend/services/aiContentService.js` | file-size | 475 líneas (límite warning: 400) |
| `backend/services/aiContentService.js` | function-size | función `analizarMetadataActivo` — 82 líneas (línea 150) |
| `backend/services/aiContentService.js` | too-many-exports | 10 funciones exportadas (límite warning: 8) |
| `backend/services/analisisFinancieroService.js` | function-size | función `nuevoTotalHuespedUSD` — 110 líneas (línea 57) |
| `backend/services/authService.js` | function-size | función `register` — 89 líneas (línea 9) |
| `backend/services/calendarioService.js` | function-size | función `obtenerDatosCalendario` — 72 líneas (línea 13) |
| `backend/services/clientesService.js` | function-size | función `crearOActualizarCliente` — 72 líneas (línea 27) |
| `backend/services/clientesService.js` | function-size | función `actualizarCliente` — 66 líneas (línea 133) |
| `backend/services/clientesService.js` | function-size | función `recalcularEstadisticasClientes` — 88 líneas (línea 248) |
| `backend/services/clientesService.js` | too-many-exports | 8 funciones exportadas (límite warning: 8) |
| `backend/services/componentesService.js` | function-size | función `analizarNuevoTipoConIA` — 70 líneas (línea 15) |
| `backend/services/contentFactoryService.js` | function-size | función `optimizarPerfilAlojamiento` — 63 líneas (línea 59) |
| `backend/services/empresaImporterService.js` | function-size | función `importarGaleriaPropiedad` — 109 líneas (línea 221) |
| `backend/services/empresaImporterService.js` | function-size | función `buildComponentes` — 62 líneas (línea 331) |
| `backend/services/empresaService.js` | function-size | función `actualizarDetallesEmpresa` — 60 líneas (línea 45) |
| `backend/services/gestionPropuestasService.js` | function-size | función `enviarEmailPropuesta` — 99 líneas (línea 215) |
| `backend/services/gestionPropuestasService.js` | function-size | función `obtenerPropuestasYPresupuestos` — 111 líneas (línea 476) |
| `backend/services/gestionPropuestasService.js` | function-size | función `aprobarPropuesta` — 82 líneas (línea 631) |
| `backend/services/gestionPropuestasService.js` | function-size | función `aprobarPresupuesto` — 68 líneas (línea 726) |
| `backend/services/gestionPropuestasService.js` | too-many-exports | 9 funciones exportadas (límite warning: 8) |
| `backend/services/googleHotelsService.js` | function-size | función `generateAriFeed` — 112 líneas (línea 53) |
| `backend/services/historicoImporterService.js` | function-size | función `runImport` — 115 líneas (línea 159) |
| `backend/services/icalService.js` | function-size | función `sincronizarCalendarios` — 109 líneas (línea 65) |
| `backend/services/kpiService.js` | function-size | función `procesarReserva` — 65 líneas (línea 93) |
| `backend/services/mensajeService.js` | file-size | 452 líneas (límite warning: 400) |
| `backend/services/mensajeService.js` | function-size | función `generarTextoReporte` — 75 líneas (línea 370) |
| `backend/services/plantillasService.js` | too-many-exports | 13 funciones exportadas (límite warning: 8) |
| `backend/services/propiedadesService.js` | function-size | función `crearPropiedad` — 99 líneas (línea 40) |
| `backend/services/propiedadesService.js` | function-size | función `actualizarPropiedad` — 86 líneas (línea 190) |
| `backend/services/propiedadLogicService.js` | function-size | función `generarPlanFotos` — 76 líneas (línea 107) |
| `backend/services/propuestasService.js` | function-size | función `getAvailabilityData` — 90 líneas (línea 31) |
| `backend/services/publicWebsiteService.js` | function-size | función `getAvailabilityData` — 85 líneas (línea 203) |
| `backend/services/publicWebsiteService.js` | function-size | función `calculatePrice` — 64 líneas (línea 314) |
| `backend/services/reparacionService.js` | function-size | función `repararFechasSODC` — 63 líneas (línea 5) |
| `backend/services/reparacionService.js` | function-size | función `verificarSincronizacionContactos` — 66 líneas (línea 127) |
| `backend/services/reportesService.js` | function-size | función `getActividadDiaria` — 90 líneas (línea 5) |
| `backend/services/reportesService.js` | function-size | función `getDisponibilidadPeriodo` — 64 líneas (línea 97) |
| `backend/services/reservasService.js` | file-size | 640 líneas (límite warning: 400) |
| `backend/services/reservasService.js` | function-size | función `crearOActualizarReserva` — 70 líneas (línea 9) |
| `backend/services/reservasService.js` | function-size | función `decidirYEliminarReserva` — 76 líneas (línea 416) |
| `backend/services/sincronizacionService.js` | file-size | 477 líneas (límite warning: 400) |
| `backend/services/storageService.js` | too-many-exports | 10 funciones exportadas (límite warning: 8) |
| `backend/services/tarifasService.js` | function-size | función `obtenerTarifasPorEmpresa` — 66 líneas (línea 56) |
| `backend/services/utils/calculoValoresService.js` | function-size | función `getValoresCLP` — 70 líneas (línea 81) |
| `backend/services/utils/cascadingUpdateService.js` | function-size | función `actualizarIdReservaCanalEnCascada` — 79 líneas (línea 6) |
| `backend/services/webImporterService.js` | function-size | función `extractFromSitemap` — 61 líneas (línea 169) |
| `backend/services/webImporterService.js` | function-size | función `analyzeTextWithAI` — 64 líneas (línea 235) |
| `backend/services/webImporterService.js` | function-size | función `analyzeImagesWithVision` — 96 líneas (línea 312) |
| `backend/services/webImporterService.js` | function-size | función `buildImportData` — 80 líneas (línea 644) |
| `backend/routes/website.js` | file-size | 505 líneas (límite warning: 400) |

---

## Plan de refactorización sugerido

> Orden de prioridad: atacar primero los archivos más grandes con más exports.

### 1. `backend/services/empresaImporterService.js` 🔴
- **996 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `createEmpresaFromImport` — 487 líneas (línea 462)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `importarGaleriaPropiedad` — 109 líneas (línea 221)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `buildComponentes` — 62 líneas (línea 331)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 2. `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` 🔴
- **873 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `actualizarContadores` — 110 líneas (línea 220)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `normalize` — 86 líneas (línea 225)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `handleAgregarComponente` — 72 líneas (línea 361)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `handleGenerarEstructuraIA` — 100 líneas (línea 434)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `renderModalAlojamiento` — 95 líneas (línea 597)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `abrirModalAlojamiento` — 115 líneas (línea 693)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 3. `backend/services/gestionPropuestasService.js` 🔴
- **810 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `guardarOActualizarPropuesta` — 201 líneas (línea 13)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `enviarEmailReservaConfirmada` — 122 líneas (línea 316)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `enviarEmailPropuesta` — 99 líneas (línea 215)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `obtenerPropuestasYPresupuestos` — 111 líneas (línea 476)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `aprobarPropuesta` — 82 líneas (línea 631)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `aprobarPresupuesto` — 68 líneas (línea 726)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **9 funciones exportadas (límite warning: 8)**
  - Revisar si puede dividirse por responsabilidad.

### 4. `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` 🔴
- **762 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `renderWizardStep` — 153 líneas (línea 104)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `openGalleryPicker` — 149 líneas (línea 441)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `renderGaleria` — 65 líneas (línea 295)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `setupGaleriaEvents` — 73 líneas (línea 591)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 5. `frontend/src/views/utils.PASO0.js` 🔴
- **726 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **18 funciones exportadas (límite crítico: 15)**
  - Agrupar responsabilidades en sub-módulos. Ej: service.read.js, service.write.js, service.calc.js
- **función `renderSelectionUI` — 70 líneas (línea 117)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `updateSummary` — 103 líneas (línea 232)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `runSearch` — 77 líneas (línea 354)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `handleGuardarPropuesta` — 99 líneas (línea 458)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `handleCargarPropuesta` — 90 líneas (línea 596)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 6. `backend/services/webImporterService.js` 🔴
- **726 líneas (límite crítico: 700)**
  - Dividir en módulos por responsabilidad. Cada módulo debe tener una sola razón para cambiar.
- **función `analyzeWebsite` — 189 líneas (línea 419)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `extractFromSitemap` — 61 líneas (línea 169)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `analyzeTextWithAI` — 64 líneas (línea 235)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `analyzeImagesWithVision` — 96 líneas (línea 312)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `buildImportData` — 80 líneas (línea 644)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 7. `backend/services/reservasService.js` 🔴
- **función `actualizarReservaManualmente` — 131 líneas (línea 80)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `obtenerReservaPorId` — 159 líneas (línea 256)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `eliminarGrupoReservasCascada` — 128 líneas (línea 504)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **640 líneas (límite warning: 400)**
  - Considerar dividir. Identificar grupos de funciones relacionadas.
- **función `crearOActualizarReserva` — 70 líneas (línea 9)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `decidirYEliminarReserva` — 76 líneas (línea 416)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 8. `frontend/src/views/importadorMagico.js` 🟡
- **636 líneas (límite warning: 400)**
  - Considerar dividir. Identificar grupos de funciones relacionadas.
- **función `renderStep1` — 68 líneas (línea 144)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `renderStep2` — 78 líneas (línea 256)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `renderStep4` — 70 líneas (línea 427)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `handleCreate` — 60 líneas (línea 498)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 9. `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` 🔴
- **función `renderWizardModal` — 155 líneas (línea 10)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **598 líneas (límite warning: 400)**
  - Considerar dividir. Identificar grupos de funciones relacionadas.
- **función `handleAnalizar` — 60 líneas (línea 221)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

### 10. `frontend/src/views/mapeosCentrales.js` 🟡
- **552 líneas (límite warning: 400)**
  - Considerar dividir. Identificar grupos de funciones relacionadas.
- **función `render` — 94 líneas (línea 41)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `afterRender` — 99 líneas (línea 216)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.
- **función `guardarMapeo` — 65 líneas (línea 474)**
  - Extraer sub-funciones con nombres descriptivos. Máximo 60 líneas por función.

---

## Umbrales configurados

| Métrica | Warning | Crítico |
|---------|---------|--------|
| Líneas por archivo | >400 | >700 |
| Líneas por función | >60 | >120 |
| Exports por archivo | >8 | >15 |

*Generado por scripts/audit-complexity.js*
