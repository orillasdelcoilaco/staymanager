# Auditoría: identificadores estables vs etiquetas de UI

**Criterio de diseño:** En persistencia, APIs y reglas de negocio deben usarse **ids** o **claves de máquina** (p. ej. `semantica`, `disparadorMotor`, códigos ISO). Los **nombres** que el usuario puede cambiar en configuración **no** deben ser la clave de comparación ni el valor guardado en entidades operativas.

**Estado del documento:** Checklist de seguimiento (no implica que todos los ítems deban cambiarse mañana; algunos son convención interna del producto).

### Avance 2026-04-24 — Fase 1 (PostgreSQL, `estado_gestion`)

- **Migración:** `backend/db/migrations/reservas-estado-gestion-id.sql` — columna `reservas.estado_gestion_id` (FK `estados_reserva`), índice, backfill por nombre + `es_gestion`. Ejecutar en cada entorno:  
  `node backend/scripts/apply-sql-migration.js db/migrations/reservas-estado-gestion-id.sql`
- **Dual write:** se sigue persistiendo `estado_gestion` (nombre) **en sincronía** con el id resuelto para listados y compatibilidad.
- **Hecho en código:** `estadosService` (helpers por id/semántica, `esFacturadoGestionReserva`, JOIN SQL reutilizable, `crearEstado` acepta `esEstadoDeGestion`), `gestionService` (pendientes por id o fallback nombre, `actualizarEstadoGrupo` por UUID o nombre), `reservas.read`/`write`, `documentosService`, `transaccionesService`, `sincronizacionService`, `historicoImporterService`, `gestionPropuestas.actions`, `publicWebsiteService`, `publicAiController`, `kpiService`, `analisisFinancieroService`, `calculoValoresService`, `clientesService`, `calendarioService`; SPA: `gestionarReservas` (select value=id), filtros tabla/cards, `mensajeModal` (avance por id), `calendario`+`calendario.gantt` (semántica pendientes).
- **PostgreSQL `estado_principal_id` (2026-04-24):** migración `backend/db/migrations/reservas-estado-principal-id.sql` + escritura en INSERT/UPDATE (`reservas.write`, `gestionService`, `routes/gestion.js`, web/IA/iCal/propuestas). JOIN principal prioriza FK. Ejecutar en cada entorno:  
  `node backend/scripts/apply-sql-migration.js db/migrations/reservas-estado-principal-id.sql`
- **Temporadas `metadata` (importador):** `backend/db/migrations/temporadas-metadata.sql` + slug `importador_general` en `tarifasService.upsertTarifaImportador`.  
  `node backend/scripts/apply-sql-migration.js db/migrations/temporadas-metadata.sql`
- **Firestore reservas (legacy, solo scripts):** el producto con `DATABASE_URL` no persiste reservas CRM en Firestore. Quedan **scripts opcionales** que leen/escriben docs `empresas/{id}/reservas` para migración o datos históricos; no son ruta de aplicación.
- **Avance 2026-04-24 (fase 3):** SQL reutilizable + cancelación correo por semántica; cubierto además: `gestionService`, `publicWebsiteService` (disponibilidad + INSERT), `propuestasService`, `icalService`, `reportesService`, `resenasService`, `clientesService` (stats), `reservas.write` (ical lookup), `publicAiController` (choque fechas PG), hooks transaccionales, SPA `calendario.js` / `mensajeModal.js` (ver fase 3 detalle en §1).
- **Avance 2026-04-24 (fase 2 parcial):** `publicAiController`: canal IA vía `metadata.origenCanal === ia_reserva` / `esCanalIaVenta` + helper `resolverCanalIaVentaEnLista` en `canalesService.js`; plantillas por disparador motor `reserva_confirmada` con fallback; `createPublicReservation` usa `canalNombre` del canal por defecto en cliente; `reparacionService` SODC une reservas por `canalNombre === 'SODC'` y por `canalId` del canal PG resuelto; `gestionDiaria.cards.js` colores del select de estado principal priorizan `semantica` con fallback solo si el catálogo no devolvió semántica.

**Leyenda por ítem**

- [ ] Pendiente
- [x] Hecho / alineado al criterio
- [n/a] No aplica (script one-off, test, o convención explícita documentada)

---

## 0. Decisiones globales (antes de tocar archivos)

- [x] Definir modelo para **`reservas.estado_gestion`**: columna **`estado_gestion_id`** (FK) + `estado_gestion` (nombre denormalizado). **`reservas.estado` principal:** pendiente decisión (sigue texto OTA en esta fase).
- [x] Modelo híbrido (2026-04-24): **`reservas.estado`** sigue siendo nombre denormalizado (OTA/listados) y **`reservas.estado_principal_id`** FK opcional + backfill; semántica vía JOIN `estados_reserva`.
- [x] Plan de **backfill** incluido en migración SQL (nombre → id para filas `es_gestion`).
- [x] Contrato **API SPA** (gestión / edición reserva): **estado de gestión** enviado como **UUID** en select y avanzar estado; backend acepta UUID o nombre (`actualizarEstadoGrupo`, `reservas.write`).
- [x] **Reservas en IA pública y cotización detalle:** con PostgreSQL activo, `checkAvailability`, `createBookingIntent`, `quotePriceForDates`, `getPropertyCalendar` y `publicAiPrecioEstimadoService.buildPrecioEstimadoDetallePublico` usan solo PG para ocupación/tarifas/bloqueos (sin rama Firestore de reservas); **sin `pool`** responden **503** donde corresponde. `verificarSincronizacionContactos` lee/actualiza **clientes** en PG. Script opcional legacy: `node backend/scripts/backfill-reservas-firestore-estados-ids.js [empresaId]`. Tipos plantilla: **`claveMotor`** + `mensajeService` (2026-04-24).
- [x] Regla de equipo documentada en `SHARED_CONTEXT.md` §3 (se mantiene vigente).

---

## 1. Estados de reserva y gestión (`estados_reserva` ↔ `reservas`)

### Backend — servicios core

| Archivo | Checklist |
|---------|-----------|
| `backend/services/gestionService.js` | [x] SQL pendientes: confirmada/desconocido por **semántica principal** + joins (2026-04-24). [x] `actualizarEstadoGrupo` acepta UUID o nombre; al elegir estado principal persiste **`estado_principal_id`** (2026-04-24). [x] Listas pendientes exponen `estadoPrincipalId` / semántica principal (2026-04-24). |
| `backend/services/estadosService.js` | [x] Helpers + JOIN principal por **`estado_principal_id` o nombre** (2026-04-24). [x] Migración FK `reservas.estado_principal_id` (2026-04-24). |
| `backend/services/reservas.write.js` | [x] INSERT/UPDATE: `estado_gestion` + ids; **`estado_principal_id`** al crear/actualizar estado principal (2026-04-24). [x] Reglas dólar / facturado vía `esFacturadoGestionReserva` (2026-04-24). |
| `backend/services/reservas.read.js` | [x] JOIN + `estadoPrincipalSemantica` + campo **`estadoPrincipalId`** (`estado_principal_id`) (2026-04-24). |
| `backend/services/documentosService.js` | [x] Resolución por `obtenerEstadoGestionRowPorSemantica(pendiente_cliente)`; sin literal SQL de respaldo — si falta catálogo no se sobrescribe `estado_gestion` (2026-04-24). |
| `backend/services/transaccionesService.js` | [x] Idem por semántica `pendiente_boleta` / `pendiente_pago`; sin literales SQL de respaldo (2026-04-24). |
| `backend/services/sincronizacionService.js` | [x] Post-confirmación: `gestionInicialRow` desde `obtenerEstadoGestionInicialPostConfirmacionRow` (nombre + id), sin string fijo (2026-04-24). |
| `backend/services/historicoImporterService.js` | [x] `estadoGestion` / `estadoGestionId` desde import o `gestionInicial` del catálogo (sin `'Pendiente Bienvenida'` hardcodeado) (2026-04-24). |
| `backend/services/gestionPropuestas.actions.js` | [x] Conflicto + INSERT presupuesto: estado confirmada por catálogo + **`estado_principal_id`** (2026-04-24). |
| `backend/services/publicWebsiteService.js` | [x] Disponibilidad + INSERT web: estado confirmado por catálogo + **`estado_principal_id`** (2026-04-24). |
| `backend/controllers/publicAiController.js` | [x] INSERT IA: `estado_gestion` + **`estado_principal_id`** por semántica confirmada (2026-04-24). [x] Canal/plantilla motor (2026-04-24). |
| `backend/services/kpiService.js` | [x] Confirmadas / facturadas como antes; filas incluyen **`estadoPrincipalId`** para consumo futuro (2026-04-24). |
| `backend/services/analisisFinancieroService.js` | [x] `esFacturado` vía `esFacturadoGestionReserva` (2026-04-24). |
| `backend/services/utils/calculoValoresService.js` | [x] Idem (2026-04-24). |
| `backend/services/clientesService.js` | [x] Estadísticas clientes: confirmadas por SQL semántica principal; fijos/dólar con `esFacturadoGestionReserva` (2026-04-24). |
| `backend/services/calendarioService.js` | [x] Eventos de reserva confirmada vía `esReservaPrincipalConfirmada` (2026-04-24). |

### Backend — rutas y jobs (SQL con `estado` / gestión)

| Archivo | Checklist |
|---------|-----------|
| `backend/routes/gestion.js` | [x] `actualizar-estado` (gestión): delega en `actualizarEstadoGrupo` (2026-04-24). [x] `actualizar-estado-reserva`: persiste **`estado_principal_id`** cuando el catálogo resuelve id (2026-04-24). |
| `backend/jobs/scheduledTransactionalEmails.js` | [x] Filtros por semántica principal + fallback literal `Confirmada`/`Propuesta` (2026-04-24). |
| `backend/jobs/expirarPropuestasIA.js` | [x] Filtro confirmada por semántica + fallback (2026-04-24). |
| `backend/services/icalService.js` | [x] Export + INSERT tentativa: semántica propuesta + **`estado_principal_id`** (2026-04-24). |
| `backend/services/reportesService.js` | [x] Actividad diaria y disponibilidad periodo por semántica confirmada (2026-04-24). |
| `backend/services/resenasService.js` | [x] Candidatos reseña automática por semántica confirmada (2026-04-24). |
| `backend/services/comunicacionesRetryService.js` | [x] Propuesta por SQL semántica + fallback (2026-04-24). |
| `backend/services/gestionPropuestas.read.js` | [x] Idem (2026-04-24). |
| `backend/services/gestionPropuestas.write.js` | [x] INSERT propuesta: nombre + **`estado_principal_id`** catálogo propuesta (2026-04-24). |
| `backend/routes/gestionPropuestas.js` | [x] Conteo propuestas por semántica (2026-04-24). |

### Backend — hooks y correo

| Archivo | Checklist |
|---------|-----------|
| `backend/services/transactionalEmailHooks.js` | [x] Resuelve semántica principal por nombre vía PG antes de `esEstadoCancelacion` (2026-04-24). |
| `backend/services/transactionalEmailService.js` | [x] `esEstadoCancelacion(nombre, semantica?)` delega en `esEstadoPrincipalCancelacionSync` (2026-04-24). |

### Frontend — SPA

| Archivo | Checklist |
|---------|-----------|
| `frontend/src/views/components/estadosStore.js` | [x] `getStatusInfo` id o nombre. [x] `LEGACY_NOMBRES` documentado como respaldo solo si catálogo vacío (2026-04-24). |
| `frontend/src/views/components/gestionDiaria/modals/mensajeModal.js` | [x] Avance por **id** con catálogo; fallback legacy también por **`estadoGestionSemantica`** (2026-04-24). |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js` | [x] Select estado reserva: **value = id**; opción seleccionada también por **`estadoPrincipalId`** del grupo (2026-04-24). |
| `frontend/src/views/components/gestionDiaria/gestionDiaria.modals.js` | [x] Muestra etiquetas desde datos de grupo/API (nombre denormalizado); coherente con id en cards (2026-04-24). |
| `frontend/src/views/gestionDiaria.js` | [x] Cambio estado reserva: envía **`nuevoEstadoReservaId`**, confirma con etiqueta; UI post-éxito por semántica + fallback (2026-04-24). |
| `frontend/src/views/gestionarReservas.js` | [x] Opciones estado gestión: **value = id** (`estadosGestion.map`); filtro lee ese valor (2026-04-24). |
| `frontend/src/views/components/gestionarReservas/reservas.table.js` | [x] Filtro por `estadoGestionId === filtro` o nombre legado (2026-04-24). |
| `frontend/src/views/components/gestionarReservas/reservas.cards.js` | [x] Idem filtro; chips rápidos por **semántica** + listas de nombres legado solo como respaldo (2026-04-24). |
| `frontend/src/views/components/gestionarReservas/reservas.modals.edit.js` | [x] Select **value = id**; valor inicial `estadoGestionId` con fallback nombre; PUT envía UUID (2026-04-24). |
| `frontend/src/views/components/gestionarReservas/reservas.modals.view.js` | [x] Muestra `estadoGestion` (nombre denormalizado de API); aceptable hasta `estado_principal_id` unificado (2026-04-24). |
| `frontend/src/views/calendario.js` | [x] Navegación a gestión diaria: lista de semánticas pendientes + regex legado si falta semántica (2026-04-24). |
| `frontend/src/views/components/calendario/calendario.gantt.js` | [x] Solo render/layout por fechas y `extendedProps`; sin reglas por nombre de estado (2026-04-24). |

---

## 2. Canales y plantillas (búsqueda por `nombre` visible)

| Archivo | Checklist |
|---------|-----------|
| `backend/controllers/publicAiController.js` | [x] Canal IA: **`metadata.origenCanal` / `esCanalIaVenta`** + nombres legados vía `resolverCanalIaVentaEnLista`. [x] Plantilla: **`disparador` motor** `reserva_confirmada` + fallback primera con email. |
| `backend/services/reparacionService.js` | [x] `repararFechasSODC`: incluye reservas con **`canalId`** del canal SODC resuelto en PG además de `canalNombre == 'SODC'`. |

---

## 3. Tarifas / temporadas

| Archivo | Checklist |
|---------|-----------|
| `backend/services/tarifasService.js` | [x] `upsertTarifaImportador`: busca temporada por **`metadata.slug = importador_general` + `anio`**; retro-marca temporadas legacy `General {año}` (2026-04-24). |

---

## 4. Mensajes y pricing (match por nombre de propiedad / tipo)

| Archivo | Checklist |
|---------|-----------|
| `backend/services/mensajeService.js` | [x] Match pricing ↔ alojamiento por **`id` de propiedad** con fallback nombre (`calculatePrice` ya expone `id` en `details`). [x] Tipos plantilla Firestore: mapa por **clave motor** (bienvenida/cobro/salida/propuesta) + fallback `includes(nombre)` (2026-04-24). |

---

## 5. Componentes de propiedad (JSON / tipos)

| Archivo | Checklist |
|---------|-----------|
| `backend/services/componentesService.js` | [n/a] Clave estable: **`tipos_componente.id` / `tipo` en JSON**; `nombre_usuario` es etiqueta — documentado en cabecera del servicio (2026-04-24). |

---

## 6. Otros dominios (revisión rápida)

| Archivo | Checklist |
|---------|-----------|
| `backend/services/campanasService.js` | [n/a] `ESTADO_A_COLUMNA` son **enums fijos de producto** (Enviado, Respondio, …), no renombrables por tenant (2026-04-24). |
| `backend/services/clientesService.js` | [n/a] `tipoCliente` heurístico (Premium/Frecuente) es **taxonomía de producto** en stats, no catálogo tenant (2026-04-24). |
| `backend/db/migrations/migrar-imagenes-firestore-postgres.js` | [x] Lookup PG: id = doc Firestore primero; si varias filas por `nombre`, preferir id coincidente con doc FS o primera por `id` + warning consola (2026-04-24). |

---

## 6b. Política de cancelación multi-tarifa (SSR público / metadata reserva)

| Archivo | Checklist |
|---------|-----------|
| `backend/services/politicaCancelacionTarifaService.js` | [x] Etiqueta visible al huésped solo desde `metadata.nombre` / `metadata.etiqueta` en la tarifa; sin UUID ni id truncado en copy. Bloques incluyen `tarifaIds` (ids estables) para trazabilidad en `metadata.politicaCancelacionCheckout`, no renderizados en EJS. |
| `frontend/src/views/components/gestionarTarifas/matriz.js` | [x] Campo «Nombre en web público» → persiste `tarifas.metadata.nombre` (etiqueta UI; vacío sobrescribe con cadena vacía en merge JSONB). |

---

## 7. Scripts y herramientas one-off (baja prioridad)

Marcar [n/a] salvo que se conviertan en rutinas de producción.

| Archivo | Checklist |
|---------|-----------|
| `backend/corregir-cabana7.js` | [n/a] Hardcode nombre elemento — solo script local. |
| `backend/reparar-capacidad-firestore.js` | [n/a] Nombre propiedad fijo — script local. |
| `backend/scripts/test_strict_creation.js` | [n/a] Test. |

---

## 8. Orden sugerido de ataque (cuando se ejecute)

1. **Modelo + migración** `reservas` (`estado_gestion_id`, y decisión sobre `estado`).
2. **`gestionService` + `routes/gestion.js` + `gestionService.actualizarEstadoGrupo`** (lectura/escritura y API).
3. **Servicios que escriben literales** (`documentosService`, `transaccionesService`, `sincronizacionService`, `historicoImporterService`).
4. **KPI / análisis / reservas.write / clientesService** (reglas “facturado”).
5. **SPA** (`gestionarReservas`, `gestionDiaria`, `mensajeModal`, `calendario`, `estadosStore`).
6. **publicAiController + reparacionService** (canal/plantilla).
7. **tarifasService**, **mensajeService**, **componentesService** según prioridad de negocio.

---

## Changelog del documento

| Fecha | Autor | Cambio |
|-------|-------|--------|
| 2026-04-24 | Auditoría código | Creación inicial checklist por archivo. |
| 2026-04-24 | Cursor | §6b política cancelación: etiqueta UI vs `tarifaIds` en bloques. |
| 2026-04-24 | Cursor | `estado_principal_id` PG + temporadas `metadata` importador + mensajeService/tarifas; Firestore reservas explícitamente diferido. |
| 2026-04-24 | Cursor | Firestore: IA disponibilidad/intent con PG; `claveMotor` tipos plantilla; script backfill IDs reservas FS; migración imágenes nombres duplicados. |
