# Reporte de Auditoría UI
**Generado:** 2026-03-24 19:08
**Archivos analizados:** 108
**Problemas encontrados:** 88 (alta: 0 / media: 17 / baja: 71)

---

## Resumen por categoría

| Categoría | Severidad | Ocurrencias |
|-----------|-----------|-------------|
| Botón con clases Tailwind directas (sin .btn-*) | media | 17 |
| Color hexadecimal hardcodeado | baja | 71 |

---

## Detalle por categoría

### Botón con clases Tailwind directas (sin .btn-*) (17 ocurrencias)
**Sugerencia:** Usar btn-primary / btn-danger / btn-success / btn-outline  
**Severidad:** media

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/app.js` | 35 | `class="px-3 py-2 bg-danger-600 text-white text-xs font-medium rounded-md hover:bg-danger-700 flex-shrink-0"` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 248 | `class="mt-4 px-6 py-2 bg-success-600 text-white rounded-lg font-bold shadow hover:bg-success-700 transition-colors"` |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 492 | `class="px-4 py-2 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"` |
| `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js` | 27 | `class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"` |
| `frontend/src/views/components/gestionarAlojamientos/componentEditor.js` | 55 | `class="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 shadow-sm"` |
| `frontend/src/views/components/gestionarClientes/clientes.table.js` | 10 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-success-100 text-success-800"` |
| `frontend/src/views/components/gestionarPlantillas/plantillas.table.js` | 17 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 68 | `class="text-[10px] bg-primary-50 text-primary-600 px-2 py-1 rounded border border-primary-200 hover:bg-primary-100 transition-colors"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 93 | `class="flex-1 bg-primary-50 text-primary-700 px-3 py-2 rounded-md text-sm border border-primary-200 hover:bg-primary-100 transition-colors flex justify-between items-center"` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 103 | `class="bg-primary-600 text-white px-3 py-1.5 rounded text-xs hover:bg-primary-700"` |
| `frontend/src/views/components/gestionarUsuarios/usuarios.table.js` | 13 | `class="px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800"` |
| `frontend/src/views/gestionarAlojamientos.js` | 38 | `class="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 transition-colors"` |
| `frontend/src/views/gestionarClientes.js` | 63 | `class="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-100 text-danger-700"` |
| `frontend/src/views/mapeoReportes.js` | 213 | `class="edit-btn px-4 py-1 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 text-sm font-medium"` |
| `frontend/src/views/procesarYConsolidar.js` | 83 | `class="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"` |
| `frontend/src/views/repararContactos.js` | 36 | `class="px-6 py-3 bg-danger-600 text-white font-semibold rounded-md hover:bg-danger-700"` |
| `frontend/src/views/repararDolar.js` | 32 | `class="px-6 py-3 bg-danger-600 text-white font-semibold rounded-md hover:bg-danger-700"` |

### Color hexadecimal hardcodeado (71 ocurrencias)
**Sugerencia:** Usar tokens de color de Tailwind config  
**Severidad:** baja

| Archivo | Línea | Clase detectada |
|---------|-------|-----------------|
| `frontend/src/utils/imageEditorModal.js` | 55 | `#fff` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#FFC107` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#FF3D00` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#4CAF50` |
| `frontend/src/views/autorizarGoogle.js` | 15 | `#1976D2` |
| `frontend/src/views/calendario.js` | 62 | `#8249` |
| `frontend/src/views/calendario.js` | 64 | `#8250` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 5 | `#3B82F6` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 5 | `#10B981` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 5 | `#F59E0B` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 5 | `#EF4444` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 6 | `#8B5CF6` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 6 | `#EC4899` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 6 | `#06B6D4` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 6 | `#F97316` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 7 | `#84CC16` |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 7 | `#14B8A6` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 70 | `#000000` |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 71 | `#FFFFFF` |
| `frontend/src/views/components/dashboard/charts.js` | 100 | `#fff` |
| `frontend/src/views/components/estadosStore.js` | 93 | `#9ca3af` |
| `frontend/src/views/components/estadosStore.js` | 96 | `#22c55e` |
| `frontend/src/views/components/estadosStore.js` | 96 | `#ef4444` |
| `frontend/src/views/components/estadosStore.js` | 96 | `#ef4444` |
| `frontend/src/views/components/estadosStore.js` | 97 | `#f59e0b` |
| `frontend/src/views/components/estadosStore.js` | 97 | `#f59e0b` |
| `frontend/src/views/components/estadosStore.js` | 98 | `#6366f1` |
| `frontend/src/views/components/estadosStore.js` | 98 | `#f59e0b` |
| `frontend/src/views/components/estadosStore.js` | 99 | `#f59e0b` |
| `frontend/src/views/components/estadosStore.js` | 99 | `#f59e0b` |
| `frontend/src/views/components/estadosStore.js` | 100 | `#6366f1` |
| `frontend/src/views/components/estadosStore.js` | 100 | `#22c55e` |
| `frontend/src/views/components/estadosStore.js` | 102 | `#9ca3af` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 8 | `#6366f1` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 8 | `#8b5cf6` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 8 | `#ec4899` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 8 | `#f59e0b` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 9 | `#10b981` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 9 | `#3b82f6` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 9 | `#ef4444` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 9 | `#14b8a6` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 10 | `#f97316` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 10 | `#84cc16` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 10 | `#0ea5e9` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 10 | `#a855f7` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 21 | `#9ca3af` |
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 52 | `#9ca3af` |
| `frontend/src/views/components/gestionarReservas/reservas.cards.js` | 23 | `#f3f4f6` |
| `frontend/src/views/components/gestionarReservas/reservas.cards.js` | 23 | `#6b7280` |
| `frontend/src/views/components/gestionarTiposComponente/tipos.list.js` | 25 | `#039` |
| `frontend/src/views/gestionarEstados.js` | 17 | `#cccccc` |
| `frontend/src/views/gestionarEstados.js` | 25 | `#cccccc` |
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
| `frontend/src/views/components/gestionarClientes/clientes.modals.js` | 14 |
| `frontend/src/views/components/estadosStore.js` | 13 |
| `frontend/src/views/components/calendario/calendario.gantt.js` | 10 |
| `frontend/src/views/importadorMagico.js` | 8 |
| `backend/views/propiedad.ejs` | 8 |
| `frontend/src/views/autorizarGoogle.js` | 4 |
| `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js` | 3 |
| `backend/views/partials/chat-widget.ejs` | 3 |
| `frontend/src/views/calendario.js` | 2 |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | 2 |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | 2 |
| `frontend/src/views/components/gestionarReservas/reservas.cards.js` | 2 |
| `frontend/src/views/gestionarEstados.js` | 2 |
| `frontend/src/app.js` | 1 |
| `frontend/src/utils/imageEditorModal.js` | 1 |

---
*Generado por scripts/audit-ui.js*
