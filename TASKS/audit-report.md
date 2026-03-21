# Reporte de Auditoría UI
**Generado:** 2026-03-21 15:07
**Archivos analizados:** 99
**Problemas encontrados:** 588 (alta: 513 / media: 38 / baja: 37)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Azul hardcodeado (debería usar primary-*) | alta | 276 |
| Rojo hardcodeado (debería usar danger-*) | alta | 150 |
| Verde hardcodeado (debería usar success-*) | alta | 87 |
| Amarillo hardcodeado (debería usar warning-*) | media | 22 |
| Botón con clases Tailwind directas (sin .btn-*) | media | 16 |
| Color hexadecimal hardcodeado | baja | 37 |

---

## Detalle por categoría

### Azul hardcodeado (debería usar primary-*) (276 ocurrencias)
**Sugerencia:** Usar bg-primary-600 / text-primary-600 / btn-primary  
**Severidad:** alta

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/app.js` | 44 | `text-blue-600` |
| `frontend/src/app.js` | 77 | `text-blue-600` |
| `frontend/src/shared/cuponesValidator.js` | 60 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | 73 | `text-blue-800` |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | 76 | `text-blue-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | 92 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 10 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 95 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 99 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 143 | `text-indigo-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 156 | `text-blue-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.ui.js` | 178 | `border-blue-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 53 | `border-indigo-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 54 | `text-indigo-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 115 | `text-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 130 | `bg-indigo-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 130 | `text-indigo-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 134 | `border-blue-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 135 | `text-blue-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 137 | `text-blue-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 138 | `text-blue-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 146 | `border-indigo-400` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 147 | `bg-indigo-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 150 | `text-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 262 | `bg-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 264 | `text-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 264 | `bg-indigo-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 347 | `text-blue-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 380 | `border-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 380 | `bg-indigo-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 386 | `text-indigo-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 387 | `text-indigo-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 388 | `border-indigo-300` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 388 | `text-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 415 | `border-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 426 | `text-blue-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 426 | `bg-blue-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 434 | `text-indigo-900` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 461 | `text-blue-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 463 | `border-blue-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 466 | `bg-blue-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 477 | `bg-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 480 | `text-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 482 | `text-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 482 | `bg-indigo-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 492 | `bg-blue-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 492 | `bg-blue-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 508 | `border-blue-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 512 | `bg-blue-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 514 | `bg-blue-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 75 | `border-indigo-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 76 | `text-indigo-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 84 | `border-indigo-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 84 | `text-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 266 | `text-blue-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js` | 25 | `border-indigo-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js` | 26 | `text-indigo-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js` | 34 | `text-blue-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 25 | `bg-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 25 | `bg-indigo-700` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 630 | `border-indigo-100` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 633 | `text-indigo-700` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 639 | `border-indigo-100` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 641 | `text-indigo-800` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 645 | `text-indigo-800` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 668 | `text-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 681 | `text-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 681 | `text-indigo-800` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.utils.js` | 34 | `text-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.utils.js` | 34 | `border-indigo-300` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 45 | `text-indigo-700` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 45 | `text-indigo-900` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 51 | `border-indigo-100` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 55 | `bg-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 55 | `bg-indigo-700` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 74 | `border-indigo-100` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 75 | `text-indigo-800` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 127 | `border-indigo-500` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 216 | `text-indigo-600` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 232 | `text-indigo-600` |
| `frontend/src/views/components/gestionarCanales/canales.modals.js` | 61 | `text-indigo-600` |
| `frontend/src/views/components/gestionarCanales/canales.modals.js` | 61 | `border-indigo-300` |
| `frontend/src/views/components/gestionarCanales/canales.modals.js` | 65 | `text-indigo-600` |
| `frontend/src/views/components/gestionarCanales/canales.modals.js` | 65 | `border-indigo-300` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 23 | `text-blue-600` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 23 | `text-blue-800` |
| `frontend/src/views/components/gestionarComentarios/tabla.js` | 43 | `text-blue-500` |
| `frontend/src/views/components/gestionarComentarios/tabla.js` | 44 | `text-blue-500` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.modals.js` | 29 | `text-indigo-700` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.modals.js` | 32 | `text-indigo-600` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.table.js` | 17 | `bg-indigo-100` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.table.js` | 17 | `text-indigo-800` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 9 | `text-blue-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 26 | `border-blue-200` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 323 | `text-blue-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 385 | `border-blue-200` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 10 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 10 | `text-indigo-800` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 80 | `text-indigo-700` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 80 | `border-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 85 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 85 | `text-indigo-800` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 42 | `border-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 43 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 50 | `border-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 56 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 57 | `border-indigo-200` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 57 | `border-indigo-500` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 58 | `border-indigo-300` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 68 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 68 | `border-indigo-200` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 68 | `bg-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 93 | `text-indigo-700` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 93 | `border-indigo-200` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 93 | `bg-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 100 | `border-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 103 | `bg-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 103 | `bg-indigo-700` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 324 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 326 | `bg-indigo-100` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 326 | `text-indigo-700` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 326 | `border-indigo-200` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 528 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 537 | `text-indigo-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 578 | `text-indigo-500` |
| `frontend/src/views/components/gestionarUsuarios/usuarios.table.js` | 13 | `bg-blue-100` |
| `frontend/src/views/components/gestionarUsuarios/usuarios.table.js` | 13 | `text-blue-800` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 100 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 103 | `text-blue-500` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 129 | `text-blue-800` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 21 | `border-blue-200` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 21 | `text-blue-800` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 29 | `text-blue-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 131 | `border-blue-200` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 132 | `text-blue-800` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 156 | `border-blue-200` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 157 | `text-blue-800` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 216 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 216 | `text-indigo-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 227 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 227 | `text-indigo-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 228 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 228 | `text-indigo-600` |
| `frontend/src/views/components/gestionDiaria/modals/documentoModal.js` | 102 | `text-blue-600` |
| `frontend/src/views/components/gestionDiaria/modals/documentoModal.js` | 115 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/documentoModal.js` | 115 | `text-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 75 | `border-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 75 | `text-indigo-500` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 140 | `text-blue-600` |
| `frontend/src/views/dashboard.js` | 20 | `bg-blue-100` |
| `frontend/src/views/dashboard.js` | 20 | `text-blue-700` |
| `frontend/src/views/dashboard.js` | 20 | `text-blue-900` |
| `frontend/src/views/empresa.js` | 67 | `text-indigo-600` |
| `frontend/src/views/empresa.js` | 67 | `text-indigo-800` |
| `frontend/src/views/galeriaPropiedad.js` | 189 | `border-blue-600` |
| `frontend/src/views/galeriaPropiedad.js` | 189 | `text-blue-700` |
| `frontend/src/views/galeriaPropiedad.js` | 221 | `bg-blue-100` |
| `frontend/src/views/galeriaPropiedad.js` | 221 | `text-blue-600` |
| `frontend/src/views/generadorPresupuestos.js` | 76 | `text-indigo-600` |
| `frontend/src/views/generadorPresupuestos.js` | 213 | `text-indigo-600` |
| `frontend/src/views/gestionarAlojamientos.js` | 38 | `bg-blue-600` |
| `frontend/src/views/gestionarAlojamientos.js` | 38 | `bg-blue-700` |
| `frontend/src/views/gestionarDolar.js` | 14 | `bg-blue-100` |
| `frontend/src/views/gestionarDolar.js` | 14 | `text-blue-800` |
| `frontend/src/views/gestionarTiposComponente.js` | 22 | `border-indigo-500` |
| `frontend/src/views/gestionarTiposElemento.js` | 80 | `text-blue-600` |
| `frontend/src/views/gestionarTiposElemento.js` | 107 | `text-blue-600` |
| `frontend/src/views/gestionarTiposElemento.js` | 107 | `text-blue-800` |
| `frontend/src/views/gestionarTiposElemento.js` | 200 | `border-blue-500` |
| `frontend/src/views/gestionarTiposElemento.js` | 208 | `text-indigo-800` |
| `frontend/src/views/gestionarTiposElemento.js` | 208 | `border-indigo-200` |
| `frontend/src/views/gestionarTiposElemento.js` | 254 | `text-blue-600` |
| `frontend/src/views/gestionDiaria.js` | 24 | `text-blue-600` |
| `frontend/src/views/importadorMagico.js` | 128 | `bg-blue-600` |
| `frontend/src/views/importadorMagico.js` | 130 | `text-blue-700` |
| `frontend/src/views/importadorMagico.js` | 156 | `border-blue-500` |
| `frontend/src/views/importadorMagico.js` | 160 | `text-blue-600` |
| `frontend/src/views/importadorMagico.js` | 191 | `text-blue-700` |
| `frontend/src/views/importadorMagico.js` | 307 | `border-blue-100` |
| `frontend/src/views/importadorMagico.js` | 307 | `text-blue-700` |
| `frontend/src/views/importadorMagico.js` | 405 | `text-blue-600` |
| `frontend/src/views/importadorMagico.js` | 435 | `border-blue-200` |
| `frontend/src/views/importadorMagico.js` | 435 | `text-blue-700` |
| `frontend/src/views/importadorMagico.js` | 455 | `text-blue-600` |
| `frontend/src/views/importadorMagico.js` | 465 | `text-blue-600` |
| `frontend/src/views/importadorMagico.js` | 575 | `bg-blue-100` |
| `frontend/src/views/importadorMagico.js` | 575 | `text-blue-700` |
| `frontend/src/views/importadorMagico.js` | 595 | `border-blue-100` |
| `frontend/src/views/importadorMagico.js` | 596 | `text-blue-800` |
| `frontend/src/views/importadorMagico.js` | 597 | `text-blue-700` |
| `frontend/src/views/login.js` | 12 | `text-indigo-600` |
| `frontend/src/views/login.js` | 12 | `text-indigo-500` |
| `frontend/src/views/login.js` | 19 | `border-indigo-500` |
| `frontend/src/views/login.js` | 23 | `border-indigo-500` |
| `frontend/src/views/login.js` | 27 | `border-indigo-500` |
| `frontend/src/views/login.js` | 30 | `bg-indigo-600` |
| `frontend/src/views/login.js` | 30 | `bg-indigo-700` |
| `frontend/src/views/mapeoReportes.js` | 194 | `bg-indigo-100` |
| `frontend/src/views/mapeoReportes.js` | 194 | `text-indigo-700` |
| `frontend/src/views/mapeoReportes.js` | 194 | `bg-indigo-200` |
| `frontend/src/views/perfilCliente.js` | 82 | `bg-blue-100` |
| `frontend/src/views/perfilCliente.js` | 82 | `text-blue-800` |
| `frontend/src/views/perfilCliente.js` | 136 | `bg-blue-100` |
| `frontend/src/views/perfilCliente.js` | 136 | `text-blue-800` |
| `frontend/src/views/perfilCliente.js` | 174 | `border-indigo-500` |
| `frontend/src/views/perfilCliente.js` | 174 | `text-indigo-600` |
| `frontend/src/views/perfilCliente.js` | 254 | `border-indigo-500` |
| `frontend/src/views/perfilCliente.js` | 254 | `text-indigo-600` |
| `frontend/src/views/perfilCliente.js` | 256 | `border-indigo-500` |
| `frontend/src/views/perfilCliente.js` | 256 | `text-indigo-600` |
| `frontend/src/views/perfilCliente.js` | 263 | `border-indigo-500` |
| `frontend/src/views/perfilCliente.js` | 263 | `text-indigo-600` |
| `frontend/src/views/perfilCliente.js` | 265 | `border-indigo-500` |
| `frontend/src/views/perfilCliente.js` | 265 | `text-indigo-600` |
| `frontend/src/views/procesarYConsolidar.js` | 77 | `text-indigo-700` |
| `frontend/src/views/procesarYConsolidar.js` | 78 | `bg-indigo-100` |
| `frontend/src/views/procesarYConsolidar.js` | 83 | `bg-indigo-600` |
| `frontend/src/views/procesarYConsolidar.js` | 83 | `bg-indigo-700` |
| `frontend/src/views/repararContactos.js` | 11 | `bg-blue-100` |
| `frontend/src/views/repararContactos.js` | 11 | `text-blue-800` |
| `frontend/src/views/repararDolar.js` | 11 | `bg-blue-100` |
| `frontend/src/views/repararDolar.js` | 11 | `text-blue-800` |
| `frontend/src/views/sincronizarCalendarios.js` | 122 | `bg-blue-100` |
| `frontend/src/views/sincronizarCalendarios.js` | 122 | `text-blue-800` |
| `frontend/src/views/utils.PASO0.js` | 108 | `text-indigo-600` |
| `frontend/src/views/utils.PASO0.js` | 312 | `text-blue-800` |
| `frontend/src/views/utils.PASO0.js` | 315 | `text-blue-600` |
| `frontend/src/views/utils.PASO0.js` | 332 | `text-indigo-600` |
| `frontend/src/views/websiteGeneral.js` | 15 | `border-indigo-600` |
| `backend/views/404.ejs` | 16 | `text-indigo-600` |
| `backend/views/home.ejs` | 60 | `bg-indigo-700` |
| `backend/views/home.ejs` | 105 | `border-indigo-600` |
| `backend/views/home.ejs` | 164 | `text-indigo-600` |
| `backend/views/partials/chat-widget.ejs` | 50 | `border-blue-500` |
| `backend/views/partials/header.ejs` | 13 | `text-indigo-600` |
| `backend/views/partials/property-card.ejs` | 25 | `text-indigo-600` |
| `backend/views/partials/property-card.ejs` | 41 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 242 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 249 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 256 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 269 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 273 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 277 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 282 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 287 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 292 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 298 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 305 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 314 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 449 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 456 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 463 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 476 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 480 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 485 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 492 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 499 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 507 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 515 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 524 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 533 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 545 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 696 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 703 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 710 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 723 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 728 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 734 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 742 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 751 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 760 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 771 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 783 | `text-indigo-600` |
| `backend/views/propiedad.ejs` | 795 | `text-indigo-600` |
| `backend/views/reservar.ejs` | 73 | `text-indigo-600` |
| `backend/views/reservar.ejs` | 128 | `text-indigo-600` |

### Rojo hardcodeado (debería usar danger-*) (150 ocurrencias)
**Sugerencia:** Usar bg-danger-600 / text-danger-600 / btn-danger  
**Severidad:** alta

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/app.js` | 35 | `bg-red-600` |
| `frontend/src/app.js` | 35 | `bg-red-700` |
| `frontend/src/router.js` | 182 | `text-red-600` |
| `frontend/src/shared/cuponesValidator.js` | 54 | `text-red-600` |
| `frontend/src/views/calendario.js` | 97 | `text-red-500` |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | 75 | `text-red-600` |
| `frontend/src/views/components/agregarPropuesta/propuesta.precios.js` | 91 | `text-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 200 | `border-red-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 201 | `bg-red-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 201 | `border-red-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 204 | `text-red-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 205 | `text-red-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 205 | `border-red-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 208 | `border-red-300` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 216 | `bg-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 216 | `bg-red-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 338 | `text-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 338 | `border-red-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 338 | `bg-red-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 412 | `bg-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 415 | `border-red-400` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 423 | `text-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 423 | `bg-red-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 286 | `text-red-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js` | 149 | `text-red-500` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 26 | `text-red-600` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 139 | `text-red-500` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 25 | `text-red-600` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 25 | `text-red-800` |
| `frontend/src/views/components/gestionarComentarios/utils.js` | 33 | `text-red-500` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 136 | `text-red-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 198 | `text-red-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 280 | `text-red-500` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 325 | `text-red-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 367 | `text-red-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 63 | `text-red-400` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 88 | `text-red-500` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 88 | `text-red-700` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 328 | `text-red-400` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 328 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 19 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 26 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 35 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 39 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 92 | `bg-red-100` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.modals.js` | 149 | `text-red-500` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 127 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 135 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 152 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 160 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/documentoModal.js` | 118 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | 143 | `text-red-500` |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | 194 | `text-red-500` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 79 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 126 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 141 | `text-red-600` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 141 | `text-red-900` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 149 | `text-red-500` |
| `frontend/src/views/conversionAlojamientos.js` | 71 | `text-red-500` |
| `frontend/src/views/dashboard.js` | 21 | `bg-red-100` |
| `frontend/src/views/dashboard.js` | 21 | `text-red-700` |
| `frontend/src/views/dashboard.js` | 21 | `text-red-900` |
| `frontend/src/views/dashboard.js` | 67 | `text-red-600` |
| `frontend/src/views/dashboard.js` | 90 | `text-red-600` |
| `frontend/src/views/dashboard.js` | 264 | `text-red-500` |
| `frontend/src/views/empresa.js` | 166 | `text-red-500` |
| `frontend/src/views/enviarMensajeCliente.js` | 53 | `text-red-500` |
| `frontend/src/views/galeriaPropiedad.js` | 103 | `text-red-700` |
| `frontend/src/views/galeriaPropiedad.js` | 160 | `text-red-700` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `bg-red-100` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `text-red-700` |
| `frontend/src/views/galeriaPropiedad.js` | 220 | `bg-red-100` |
| `frontend/src/views/galeriaPropiedad.js` | 220 | `text-red-600` |
| `frontend/src/views/gestionarAlojamientos.js` | 22 | `text-red-500` |
| `frontend/src/views/gestionarAlojamientos.js` | 65 | `text-red-500` |
| `frontend/src/views/gestionarCanales.js` | 14 | `text-red-500` |
| `frontend/src/views/gestionarCanales.js` | 22 | `text-red-500` |
| `frontend/src/views/gestionarClientes.js` | 26 | `text-red-500` |
| `frontend/src/views/gestionarComentarios.js` | 25 | `text-red-500` |
| `frontend/src/views/gestionarDolar.js` | 12 | `bg-red-100` |
| `frontend/src/views/gestionarDolar.js` | 12 | `text-red-800` |
| `frontend/src/views/gestionarDolar.js` | 54 | `text-red-500` |
| `frontend/src/views/gestionarEstados.js` | 99 | `text-red-500` |
| `frontend/src/views/gestionarPlantillas.js` | 20 | `text-red-500` |
| `frontend/src/views/gestionarPlantillas.js` | 31 | `text-red-500` |
| `frontend/src/views/gestionarPropuestas.js` | 53 | `text-red-600` |
| `frontend/src/views/gestionarPropuestas.js` | 87 | `text-red-500` |
| `frontend/src/views/gestionarReservas.js` | 38 | `text-red-500` |
| `frontend/src/views/gestionarReservas.js` | 224 | `text-red-700` |
| `frontend/src/views/gestionarTarifas.js` | 39 | `bg-red-100` |
| `frontend/src/views/gestionarTarifas.js` | 39 | `text-red-800` |
| `frontend/src/views/gestionarTarifas.js` | 43 | `text-red-500` |
| `frontend/src/views/gestionarTiposAmenidad.js` | 146 | `text-red-400` |
| `frontend/src/views/gestionarTiposAmenidad.js` | 146 | `text-red-600` |
| `frontend/src/views/gestionarTiposComponente.js` | 161 | `text-red-500` |
| `frontend/src/views/gestionarTiposElemento.js` | 110 | `text-red-500` |
| `frontend/src/views/gestionarTiposElemento.js` | 110 | `text-red-700` |
| `frontend/src/views/gestionarTiposPlantilla.js` | 101 | `text-red-500` |
| `frontend/src/views/gestionarUsuarios.js` | 15 | `text-red-500` |
| `frontend/src/views/gestionarUsuarios.js` | 24 | `text-red-500` |
| `frontend/src/views/gestionDiaria.js` | 23 | `text-red-600` |
| `frontend/src/views/gestionDiaria.js` | 90 | `text-red-500` |
| `frontend/src/views/gestionDiaria.js` | 91 | `text-red-500` |
| `frontend/src/views/gestionDiaria.js` | 147 | `bg-red-100` |
| `frontend/src/views/gestionDiaria.js` | 151 | `bg-red-100` |
| `frontend/src/views/historialCampanas.js` | 60 | `text-red-500` |
| `frontend/src/views/historialCampanas.js` | 114 | `text-red-500` |
| `frontend/src/views/importadorMagico.js` | 149 | `border-red-200` |
| `frontend/src/views/importadorMagico.js` | 149 | `text-red-700` |
| `frontend/src/views/importadorMagico.js` | 171 | `border-red-300` |
| `frontend/src/views/importadorMagico.js` | 171 | `border-red-300` |
| `frontend/src/views/importadorMagico.js` | 172 | `text-red-600` |
| `frontend/src/views/importadorMagico.js` | 178 | `border-red-300` |
| `frontend/src/views/importadorMagico.js` | 178 | `text-red-700` |
| `frontend/src/views/importadorMagico.js` | 408 | `text-red-400` |
| `frontend/src/views/importadorMagico.js` | 408 | `text-red-600` |
| `frontend/src/views/importadorMagico.js` | 472 | `border-red-200` |
| `frontend/src/views/importadorMagico.js` | 472 | `text-red-700` |
| `frontend/src/views/login.js` | 35 | `text-red-600` |
| `frontend/src/views/mapeoReportes.js` | 73 | `text-red-500` |
| `frontend/src/views/mapeoReportes.js` | 93 | `text-red-500` |
| `frontend/src/views/mapeoReportes.js` | 130 | `text-red-500` |
| `frontend/src/views/mapeoReportes.js` | 144 | `text-red-500` |
| `frontend/src/views/mapeoReportes.js` | 176 | `text-red-500` |
| `frontend/src/views/perfilCliente.js` | 85 | `bg-red-100` |
| `frontend/src/views/perfilCliente.js` | 85 | `text-red-800` |
| `frontend/src/views/perfilCliente.js` | 96 | `bg-red-100` |
| `frontend/src/views/perfilCliente.js` | 96 | `text-red-800` |
| `frontend/src/views/perfilCliente.js` | 125 | `text-red-500` |
| `frontend/src/views/procesarYConsolidar.js` | 12 | `text-red-700` |
| `frontend/src/views/procesarYConsolidar.js` | 13 | `text-red-600` |
| `frontend/src/views/procesarYConsolidar.js` | 52 | `text-red-500` |
| `frontend/src/views/repararContactos.js` | 9 | `bg-red-100` |
| `frontend/src/views/repararContactos.js` | 9 | `text-red-800` |
| `frontend/src/views/repararContactos.js` | 36 | `bg-red-600` |
| `frontend/src/views/repararContactos.js` | 36 | `bg-red-700` |
| `frontend/src/views/repararDolar.js` | 9 | `bg-red-100` |
| `frontend/src/views/repararDolar.js` | 9 | `text-red-800` |
| `frontend/src/views/repararDolar.js` | 32 | `bg-red-600` |
| `frontend/src/views/repararDolar.js` | 32 | `bg-red-700` |
| `frontend/src/views/sincronizarCalendarios.js` | 113 | `text-red-500` |
| `frontend/src/views/sincronizarCalendarios.js` | 155 | `bg-red-100` |
| `frontend/src/views/sincronizarCalendarios.js` | 155 | `text-red-800` |
| `frontend/src/views/utils.PASO0.js` | 314 | `text-red-600` |
| `frontend/src/views/utils.PASO0.js` | 331 | `text-red-600` |
| `frontend/src/views/utils.PASO0.js` | 451 | `text-red-600` |
| `frontend/src/views/websiteAlojamientos.js` | 64 | `text-red-500` |
| `frontend/src/views/websiteGeneral.js` | 40 | `text-red-500` |
| `backend/views/home.ejs` | 179 | `text-red-500` |
| `backend/views/reservar.ejs` | 180 | `text-red-600` |

### Verde hardcodeado (debería usar success-*) (87 ocurrencias)
**Sugerencia:** Usar bg-success-600 / text-success-600 / btn-success  
**Severidad:** alta

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/shared/cuponesValidator.js` | 48 | `text-green-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 180 | `bg-green-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 183 | `text-green-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 185 | `border-green-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 241 | `bg-green-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 244 | `text-green-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 248 | `bg-green-600` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 248 | `bg-green-700` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 306 | `bg-green-100` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 306 | `text-green-800` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 413 | `bg-green-500` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 282 | `text-green-600` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.table.js` | 23 | `text-green-600` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 10 | `bg-green-100` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 10 | `text-green-800` |
| `frontend/src/views/components/gestionarComentarios/utils.js` | 88 | `text-green-600` |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 198 | `text-green-600` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 239 | `text-green-500` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 373 | `text-green-500` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 20 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 25 | `text-green-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 36 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 38 | `text-green-600` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 63 | `bg-green-500` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 63 | `bg-green-700` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 90 | `bg-green-100` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 128 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 135 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 153 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 160 | `text-green-700` |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | 163 | `bg-green-600` |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | 163 | `bg-green-700` |
| `frontend/src/views/components/gestionDiaria/modals/pagosModal.js` | 125 | `text-green-600` |
| `frontend/src/views/dashboard.js` | 16 | `bg-green-100` |
| `frontend/src/views/dashboard.js` | 16 | `text-green-700` |
| `frontend/src/views/dashboard.js` | 16 | `text-green-900` |
| `frontend/src/views/dashboard.js` | 17 | `bg-green-100` |
| `frontend/src/views/dashboard.js` | 17 | `text-green-700` |
| `frontend/src/views/dashboard.js` | 17 | `text-green-900` |
| `frontend/src/views/dashboard.js` | 18 | `bg-green-100` |
| `frontend/src/views/dashboard.js` | 18 | `text-green-700` |
| `frontend/src/views/dashboard.js` | 18 | `text-green-900` |
| `frontend/src/views/dashboard.js` | 64 | `text-green-700` |
| `frontend/src/views/dashboard.js` | 88 | `text-green-700` |
| `frontend/src/views/empresa.js` | 13 | `bg-green-100` |
| `frontend/src/views/empresa.js` | 13 | `border-green-300` |
| `frontend/src/views/empresa.js` | 14 | `text-green-800` |
| `frontend/src/views/empresa.js` | 15 | `text-green-700` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `bg-green-100` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `text-green-700` |
| `frontend/src/views/galeriaPropiedad.js` | 218 | `bg-green-600` |
| `frontend/src/views/galeriaPropiedad.js` | 218 | `bg-green-700` |
| `frontend/src/views/galeriaPropiedad.js` | 337 | `bg-green-600` |
| `frontend/src/views/gestionarDolar.js` | 13 | `bg-green-100` |
| `frontend/src/views/gestionarDolar.js` | 13 | `text-green-800` |
| `frontend/src/views/gestionDiaria.js` | 26 | `text-green-600` |
| `frontend/src/views/gestionDiaria.js` | 147 | `bg-green-100` |
| `frontend/src/views/gestionDiaria.js` | 149 | `bg-green-100` |
| `frontend/src/views/historialCampanas.js` | 22 | `text-green-600` |
| `frontend/src/views/importadorMagico.js` | 126 | `bg-green-500` |
| `frontend/src/views/importadorMagico.js` | 130 | `text-green-600` |
| `frontend/src/views/importadorMagico.js` | 482 | `text-green-700` |
| `frontend/src/views/importadorMagico.js` | 575 | `bg-green-100` |
| `frontend/src/views/importadorMagico.js` | 575 | `text-green-700` |
| `frontend/src/views/perfilCliente.js` | 83 | `bg-green-100` |
| `frontend/src/views/perfilCliente.js` | 83 | `text-green-800` |
| `frontend/src/views/perfilCliente.js` | 94 | `bg-green-100` |
| `frontend/src/views/perfilCliente.js` | 94 | `text-green-800` |
| `frontend/src/views/perfilCliente.js` | 152 | `text-green-600` |
| `frontend/src/views/procesarYConsolidar.js` | 20 | `bg-green-100` |
| `frontend/src/views/procesarYConsolidar.js` | 20 | `border-green-400` |
| `frontend/src/views/procesarYConsolidar.js` | 20 | `text-green-700` |
| `frontend/src/views/repararContactos.js` | 10 | `bg-green-100` |
| `frontend/src/views/repararContactos.js` | 10 | `text-green-800` |
| `frontend/src/views/repararDolar.js` | 10 | `bg-green-100` |
| `frontend/src/views/repararDolar.js` | 10 | `text-green-800` |
| `frontend/src/views/sincronizarCalendarios.js` | 149 | `bg-green-100` |
| `frontend/src/views/sincronizarCalendarios.js` | 149 | `text-green-800` |
| `frontend/src/views/utils.PASO0.js` | 446 | `text-green-600` |
| `backend/views/confirmacion.ejs` | 20 | `text-green-500` |
| `backend/views/home.ejs` | 110 | `text-green-600` |
| `backend/views/partials/chat-widget.ejs` | 24 | `bg-green-400` |
| `backend/views/partials/property-card.ejs` | 26 | `text-green-600` |
| `backend/views/propiedad.ejs` | 234 | `bg-green-500` |
| `backend/views/propiedad.ejs` | 234 | `bg-green-600` |
| `backend/views/propiedad.ejs` | 441 | `bg-green-500` |
| `backend/views/propiedad.ejs` | 441 | `bg-green-600` |

### Amarillo hardcodeado (debería usar warning-*) (22 ocurrencias)
**Sugerencia:** Usar bg-warning-600 / text-warning-600  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 297 | `border-yellow-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 348 | `border-yellow-200` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 348 | `text-yellow-800` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 94 | `bg-yellow-100` |
| `frontend/src/views/dashboard.js` | 22 | `bg-yellow-100` |
| `frontend/src/views/dashboard.js` | 22 | `text-yellow-700` |
| `frontend/src/views/dashboard.js` | 22 | `text-yellow-800` |
| `frontend/src/views/dashboard.js` | 68 | `text-yellow-800` |
| `frontend/src/views/empresa.js` | 17 | `bg-yellow-100` |
| `frontend/src/views/empresa.js` | 17 | `border-yellow-300` |
| `frontend/src/views/empresa.js` | 18 | `text-yellow-800` |
| `frontend/src/views/empresa.js` | 19 | `text-yellow-700` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `bg-yellow-100` |
| `frontend/src/views/galeriaPropiedad.js` | 195 | `text-yellow-700` |
| `frontend/src/views/gestionDiaria.js` | 147 | `bg-yellow-100` |
| `frontend/src/views/gestionDiaria.js` | 153 | `bg-yellow-100` |
| `frontend/src/views/importadorMagico.js` | 588 | `border-yellow-200` |
| `frontend/src/views/importadorMagico.js` | 589 | `text-yellow-800` |
| `frontend/src/views/importadorMagico.js` | 590 | `text-yellow-700` |
| `frontend/src/views/perfilCliente.js` | 155 | `text-yellow-500` |
| `frontend/src/views/sincronizarCalendarios.js` | 147 | `bg-yellow-100` |
| `frontend/src/views/sincronizarCalendarios.js` | 147 | `text-yellow-800` |

### Botón con clases Tailwind directas (sin .btn-*) (16 ocurrencias)
**Sugerencia:** Usar btn-primary / btn-danger / btn-success / btn-outline  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/app.js` | 35 | `class="px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 flex-shrink-0"` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 248 | `class="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 transition-colors"` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 492 | `class="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 25 | `class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 55 | `class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 shadow-sm"` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 10 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.table.js` | 17 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 68 | `class="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 93 | `class="flex-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-md text-sm border border-indigo-200 hover:bg-indigo-100 transition-colors flex justify-between items-center"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 103 | `class="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs hover:bg-indigo-700"` |
| `frontend/src/views/components/gestionarUsuarios/usuarios.table.js` | 13 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"` |
| `frontend/src/views/gestionarAlojamientos.js` | 38 | `class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"` |
| `frontend/src/views/mapeoReportes.js` | 194 | `class="edit-btn px-4 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium"` |
| `frontend/src/views/procesarYConsolidar.js` | 83 | `class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"` |
| `frontend/src/views/repararContactos.js` | 36 | `class="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700"` |
| `frontend/src/views/repararDolar.js` | 32 | `class="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700"` |

### Color hexadecimal hardcodeado (37 ocurrencias)
**Sugerencia:** Usar tokens de color de Tailwind config  
**Severidad:** baja

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/utils/imageEditorModal.js` | 55 | `#fff` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#FFC107` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#FF3D00` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#4CAF50` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#1976D2` |
| `frontend/src/views/calendario.js` | 6 | `#003580` |
| `frontend/src/views/calendario.js` | 7 | `#2ECC71` |
| `frontend/src/views/calendario.js` | 8 | `#2ECC71` |
| `frontend/src/views/calendario.js` | 9 | `#E74C3C` |
| `frontend/src/views/calendario.js` | 10 | `#95A5A6` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 70 | `#000000` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 71 | `#FFFFFF` |
| `frontend/src/views/components/dashboard/charts.js` | 100 | `#fff` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 25 | `#039` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.utils.js` | 18 | `#9ca3af` |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.utils.js` | 26 | `#f59e0b` |
| `frontend/src/views/gestionarEstados.js` | 16 | `#cccccc` |
| `frontend/src/views/gestionarEstados.js` | 23 | `#cccccc` |
| `frontend/src/views/importadorMagico.js` | 56 | `#f87171` |
| `frontend/src/views/importadorMagico.js` | 56 | `#4ade80` |
| `frontend/src/views/importadorMagico.js` | 56 | `#60a5fa` |
| `frontend/src/views/importadorMagico.js` | 56 | `#e5e7eb` |
| `frontend/src/views/importadorMagico.js` | 199 | `#111827` |
| `frontend/src/views/importadorMagico.js` | 199 | `#374151` |
| `frontend/src/views/importadorMagico.js` | 490 | `#111827` |
| `frontend/src/views/importadorMagico.js` | 490 | `#374151` |
| `backend/views/partials/chat-widget.ejs` | 7 | `#4F46E5` |
| `backend/views/partials/chat-widget.ejs` | 22 | `#4F46E5` |
| `backend/views/partials/chat-widget.ejs` | 53 | `#4F46E5` |
| `backend/views/propiedad.ejs` | 95 | `#4f46e5` |
| `backend/views/propiedad.ejs` | 97 | `#10b981` |
| `backend/views/propiedad.ejs` | 345 | `#10094` |
| `backend/views/propiedad.ejs` | 347 | `#10095` |
| `backend/views/propiedad.ejs` | 576 | `#10094` |
| `backend/views/propiedad.ejs` | 578 | `#10095` |
| `backend/views/propiedad.ejs` | 828 | `#10094` |
| `backend/views/propiedad.ejs` | 830 | `#10095` |

---

## Vistas con más problemas

| Archivo | Problemas |
|---------|----------|
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 69 |
| `backend/views/propiedad.ejs` | 49 |
| `frontend/src/views/importadorMagico.js` | 44 |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 30 |
| `frontend/src/views/perfilCliente.js` | 25 |
| `frontend/src/views/dashboard.js` | 24 |
| `frontend/src/views/components/gestionDiaria/modals/ajusteTarifaModal.js` | 21 |
| `frontend/src/views/galeriaPropiedad.js` | 17 |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | 16 |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 13 |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 11 |
| `frontend/src/views/empresa.js` | 11 |
| `frontend/src/views/gestionDiaria.js` | 11 |
| `frontend/src/views/procesarYConsolidar.js` | 11 |
| `frontend/src/views/components/gestionarReservas/reservas.modals.js` | 10 |

---
*Generado por scripts/audit-ui.js*
