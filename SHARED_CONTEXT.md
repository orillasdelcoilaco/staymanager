# 🧠 SHARED_CONTEXT.md — Fuente Única de Verdad del Proyecto

> **Atajo de una sola instrucción al agente:** «Antes de hacer algo, lee `LEER-PRIMERO.md`» (raíz del repo) — orden de lectura y coordinación multi-agente en `TASKS/`.
>
> **Este archivo es consultado por TODOS los agentes de IA del equipo.**
> - **Antigravity** (Claude Opus 4.6 en IDE) → lo lee via Knowledge Items
> - **Claude Code** (CLI) → lo lee via CLAUDE.md (que referencia este archivo)
> - **Cualquier nuevo agente** → debe leer este archivo PRIMERO
>
> **Regla**: Si hay conflicto entre este archivo y CLAUDE.md/.clinerules,
> este archivo tiene prioridad (es más reciente y refleja el estado real).
>
> **IA de venta (ChatGPT / OpenAPI / reserva pública) con Cursor en paralelo:** además de este archivo, leer `TASKS/backlog-producto-pendientes.md` (roadmap) y `TASKS/coordinacion-cursor-claude-ia-venta.md` (avisos cruzados). El detalle del procedimiento para Claude Code está en `CLAUDE.md` (sección *Antigravity / IA de venta*).
>
> **Refactor en curso — identificadores vs nombres (2026-04-24):** no introducir nuevas dependencias de **nombres/etiquetas que el usuario puede cambiar** (p. ej. `estados_reserva.nombre`, `canales.nombre`, nombre de plantilla) como clave en SQL, comparaciones de negocio o payloads API. Usar **id**, **`semantica`** (donde ya exista) o claves de producto acordadas; el nombre solo para UI. Inventario y checklist: `TASKS/audit-identificadores-vs-nombres-ui.md`.

---

## 📋 Registro de Actualizaciones

| Fecha | Autor | Cambio |
|---|---|---|
| 2026-04-24 | Cursor | Reseña outbound: variable `[LINK_RESEÑA]` en correo de confirmación de reserva y recordatorio pre-llegada (`resolverLinkResenaOutbound` en `transactionalEmailService.js`) |
| 2026-04-24 | Cursor | Retención opcional PII identidad check-in web: ajustes en `websiteSettings.booking`, job `npm run job:retencion-checkin-identidad-pii`; documentado en §2.2 |
| 2026-04-24 | Cursor | Implementación fase 1: `reservas.estado_gestion_id` (migración `backend/db/migrations/reservas-estado-gestion-id.sql`), servicios y SPA parcial; checklist actualizado en `TASKS/audit-identificadores-vs-nombres-ui.md` |
| 2026-04-24 | Cursor | Aviso global + regla §3: catálogos por id/semántica; checklist `TASKS/audit-identificadores-vs-nombres-ui.md` |
| 2026-04-24 | Cursor | Nota en cabecera: backlog + coordinación IA venta cuando Cursor y Claude trabajan en paralelo |
| 2026-04-24 | Cursor | Trazabilidad: historial también en `UPDATE` de sincronización (`_crearOActualizarReservaPG`) en transacción, `limpiarFlagsLegado: false` |
| 2026-04-24 | Cursor | Trazabilidad de ajustes de valor: `historialAjustes` en `reservas.metadata` + `trazabilidadService` PG (`appendAjusteValorHistorialPg`); integrado en `reservas.write` y `analisisFinancieroService` |
| 2026-04-24 | Cursor | Dev local sin PG: `dbConfig` avisa en consola (no production); `backend/.env.example`; SHARED_CONTEXT 2.1 párrafo desarrollo local |
| 2026-04-24 | Cursor | Reservas CRM + clientes por empresa: fuente operativa PostgreSQL con `DATABASE_URL`; IA pública y reparaciones alineadas; scripts Firestore de reservas solo legacy/migración (apartado 2.1) |
| 2026-03-29 | Antigravity | Creación inicial. Documentado modo dual PostgreSQL/Firestore, estado de migración, arquitectura actual |

---

## 1. 🏗️ Arquitectura Actual (Estado Real — Marzo 2026)

### Base de Datos: MODO DUAL (PostgreSQL + Firestore)

```
┌─────────────────────────────────────────────────────────┐
│  MODO DUAL — El sistema decide en runtime               │
│                                                          │
│  DATABASE_URL definida → PostgreSQL (Supabase Pro)       │
│  DATABASE_URL ausente  → Firestore (legacy)              │
│                                                          │
│  Implementado en: backend/db/postgres.js                 │
│  Pool: pg (node-postgres), NO ORM, SQL directo           │
│  Conexión: PgBouncer puerto 6543 (Supabase)              │
└─────────────────────────────────────────────────────────┘
```

### Patrón de Servicio (Cómo se escribe código AHORA)

```javascript
const pool = require('../db/postgres');

// Función de mapeo LOCAL (cada servicio tiene la suya)
function mapear(row) {
    return {
        id: row.id,
        empresaId: row.empresa_id,      // ← snake_case → camelCase SIEMPRE
        fechaLlegada: row.fecha_llegada,
        valores: row.valores || {},      // ← JSONB se pasa directo
    };
}

const obtener = async (db, empresaId) => {
    if (pool) {
        // ✅ RUTA POSTGRESQL (activa si DATABASE_URL existe)
        const { rows } = await pool.query(
            'SELECT * FROM tabla WHERE empresa_id = $1', [empresaId]
        );
        return rows.map(mapear);
    }
    // ⚠️ RUTA FIRESTORE (legacy, fallback)
    const snap = await db.collection('empresas').doc(empresaId)
        .collection('tabla').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
```

### Stack Técnico Confirmado

| Capa | Tecnología | Notas |
|---|---|---|
| Backend | Node.js + Express | — |
| Frontend SPA | Vanilla JavaScript | Sin React, sin framework |
| Base de datos | PostgreSQL (Supabase Pro) | Migrando desde Firestore |
| Base de datos (legacy) | Firebase Firestore | Solo si DATABASE_URL no está |
| Autenticación | Firebase Auth + JWT propio | Se mantiene |
| Storage | Firebase Storage | Se mantiene (por ahora) |
| CSS | TailwindCSS 3.x | Con tokens semánticos |
| Templates SSR | EJS | — |
| IA | Google Gemini | Generación de contenido |
| Pagos | MercadoPago | — |
| Búsqueda semántica | pgvector (Supabase) | En propiedades |

---

## 2. 📊 Estado de Migración PostgreSQL

### Clasificación de Datos

| Grupo | Prioridad | Descripción | Estado |
|---|---|---|---|
| **A** | ⭐ MÁXIMA | Configuración (empresas, propiedades, canales, etc.) | ✅ Schema creado, servicios en migración |
| **B** | ALTA | Reservas (reservas, transacciones, clientes, KPIs) | ✅ Schema creado, servicios migrados (`reservas.read.js`) |
| **C** | MEDIA | Features (CRM, galería, tipos, comunicaciones) | ✅ Schema creado (`schema-grupo-c.sql`) |

### Schema SQL
- **Principal**: Definido en `TASKS/migration-plan-postgres.md` (sección 3)
- **Grupo C**: `backend/db/schema-grupo-c.sql`

### Tablas PostgreSQL Creadas

```
empresas, usuarios, propiedades (con vector), canales, clientes,
estados_reserva, historial_cargas, reservas, transacciones,
mapeos, mapeos_centrales, conversiones, bloqueos, plantillas,
bitacora, tarifas, ical_feeds, presupuestos, campanas, cupones,
galeria, tipos_elemento, tipos_componente, tipos_amenidad,
interacciones, comunicaciones
```

### 2.1 Reservas y clientes CRM (fuente operativa con PostgreSQL)

Cuando existe **`DATABASE_URL`** (producción y staging esperados):

- **Reservas del producto** viven en la tabla PostgreSQL `reservas` (servicios `reservas.*`, gestión, SSR, propuestas, iCal, disponibilidad en `propuestasService`, etc.). **No** usar la subcolección Firestore `empresas/{empresaId}/reservas` en rutas ni servicios del panel o del sitio público.
- **Clientes del CRM** por empresa viven en `clientes` (`clientesService`). Incluye `verificarSincronizacionContactos` en `reparacionService`, que solo lee y actualiza filas en PostgreSQL.
- **API IA pública** (`publicAiController`, cotización detalle en `publicAiPrecioEstimadoService`) y **disponibilidad SSR** (`publicWebsiteService.getAvailabilityData`): la ocupación y tarifas **exigen** `pool`. En IA pública, sin PostgreSQL se responde **503** con `SERVICE_UNAVAILABLE` donde ya está cableado; en otros servicios la ausencia de `pool` lanza error explícito al llamar a disponibilidad.
- **Scripts** que aún tocan `empresas/.../reservas` en Firestore (p. ej. `backend/scripts/backfill-reservas-firestore-estados-ids.js`, `backend/scripts/verify_property_migration_result.js`, `scripts/borrar-historico-prueba.js`) son **solo migración o limpieza legacy**, no el flujo operativo del SaaS.
- **Trazabilidad de ajustes de valor** (`valorHuespedOriginal` en USD de referencia): se registra en `reservas.metadata.historialAjustes` vía `utils/trazabilidadService.appendAjusteValorHistorialPg` — en `reservas.write`, edición manual (`_aplicarUpdateReservaManualConHistorialPg`) e importación/sincronización (`_aplicarUpdateReservaSyncConHistorialPg`) cada una en **su propia transacción**; ajuste de grupo en `analisisFinancieroService`. La firma antigua `registrarAjusteValor` delega en PostgreSQL si se usa.

Firestore sigue en uso para Auth, tokens OAuth (Google), Firebase Storage, y subcolecciones que el proyecto aún no haya movido por completo (p. ej. `valoresDolar` en algunos flujos).

#### Desarrollo local sin `DATABASE_URL`

Si **no** defines `DATABASE_URL`, `backend/config/dbConfig.js` elige modo **Firestore (legacy)** y `require('../db/postgres')` exporta **`null`**. Eso implica:

- Panel y APIs que lean o escriban **reservas** y **clientes** en tablas PostgreSQL fallan o quedan vacíos según la ruta.
- **SSR / disponibilidad**, **propuestas**, **API IA pública** y **reparación** (SODC, contactos) esperan `pool` (errores explícitos o **503** donde ya está cableado).

**Recomendación:** plantilla `backend/.env.example` — copiar a `backend/.env` y rellenar al menos `DATABASE_URL` (instancia local con Docker, base de solo lectura de staging, o Supabase). Opcional: `DB_MODE=postgres` para forzar motor PostgreSQL aunque cambie la heurística por defecto.

En **no** `production`, al arrancar sin Postgres el servidor escribe un **warning** en consola (`[dbConfig]`) con el mismo resumen.

### 2.2 Retención automática PII identidad (check-in web, PostgreSQL)

**Objetivo:** permitir que cada empresa **active o no** el borrado automático de datos sensibles del checkout web en `metadata.reservaWebCheckout`: **identidad** (`checkInIdentidad`, co-huéspedes, consentimiento) y **llegada ligera** (hora estimada, medio, referencias de transporte/ref. viajero, comentarios del huésped), **X días después del check-out** (`fecha_salida`), sin TTL global forzado.

**Configuración** (`websiteSettings.booking`, saneado en `backend/services/bookingSettingsSanitize.js`):

| Clave | Tipo | Notas |
|---|---|---|
| `checkinIdentidadRetencionAutomaticaActivo` | boolean | Si es `false` o ausente, el job **no** toca esa empresa. |
| `checkinIdentidadRetencionDiasTrasCheckout` | entero 1–730 | Días tras la fecha de salida; fuera de rango se hace *clamp*; defecto práctico 90. |

**UI:** panel **Configurar sitio web público** (wizard unificado), bloque *Retención datos identidad (check-in web)* — `frontend/src/views/components/configurarWebPublica/webPublica.general.unified.{markup,handlers}.js`.

**Job (no corre solo hasta que operaciones lo programe):**

```bash
npm run job:retencion-checkin-identidad-pii
npm run job:retencion-checkin-identidad-pii -- --dry-run
```

- Requiere **`DATABASE_URL`** (solo ruta PostgreSQL; no aplica retención masiva en Firestore legacy para este flujo).
- Procesa por empresa con flag activo; candidatas: reserva con PII de identidad **o** texto en campos de llegada/comentarios del checkout aún presente, y `fecha_salida` **anterior** a `hoy − X días` (zona UTC del servidor).
- Tras borrar, `metadata.reservaWebCheckout.checkInIdentidadEliminacion` puede incluir `eliminadoMotivo: retencion_automatica_post_checkout`, `diasPoliticaRetencion`, `eliminadoPorEmail: retencion-politica-empresa` (además de `eliminadoAt`); la misma limpieza de campos PII que el borrado manual vía `reservaWebCheckinIdentidadService.metadataTrasEliminarPiiCheckinIdentidad`.

**Código:** `backend/services/reservaWebCheckinIdentidadRetencionService.js`, entrypoint `backend/scripts/job-retencion-checkin-identidad-pii.js`, script NPM en `package.json` (`job:retencion-checkin-identidad-pii`). Tests: `backend/scripts/test-booking-settings-sanitize.js`, `backend/scripts/test-reserva-web-checkin-identidad-pii-eliminar.js`.

**Operación (ej. Render o cron del host):** programar ejecución diaria (o semanal) del comando anterior con las mismas variables de entorno que el backend (al menos `DATABASE_URL`). Primera vez recomendable `--dry-run` y revisar logs.

---

## 3. 🔒 Reglas Inquebrantables (Para TODOS los agentes)

### Seguridad
- ❌ NUNCA exponer claves, API keys o secretos en código
- ✅ SIEMPRE usar `process.env.NOMBRE_VARIABLE`
- ❌ NUNCA leer/modificar `.env`, `serviceAccountKey.json`

### Multi-Tenant
- ✅ PostgreSQL: `WHERE empresa_id = $1` en TODA query
- ✅ Firestore (legacy): `empresas/{id}/...` en toda ruta
- ❌ NUNCA hacer queries globales sin filtro de empresa
- ⚠️ EXCEPCIÓN: Public API usa `collectionGroup` (solo datos públicos)

### Inmutabilidad Financiera
- ❌ NUNCA sobrescribir `valores.valorHuesped` con cálculos
- ✅ Los motores de cálculo generan KPIs de referencia, no reemplazan
- ✅ `historialAjustes` registra TODO cambio con trazabilidad

### Reservas
- ✅ `idReservaCanal` es el identificador de grupo
- ✅ Si iCal + Reporte coinciden → completar, NO duplicar
- ✅ `edicionesManuales: {campo: true}` protege campos editados manualmente

### Catálogos configurables (ids y semántica, no nombre como clave)
- ❌ **No** usar como clave de negocio: `nombre` de filas que el administrador puede renombrar (`estados_reserva`, canales, plantillas, temporadas, etc.), ni literales que copien esa etiqueta (`estado_gestion = 'Pendiente …'`, `find(c => c.nombre === 'IA Reserva')`, filtros `WHERE estado = 'Confirmada'` si ese valor es solo el nombre visible).
- ✅ **Sí** usar: `id` (UUID/FK), columna **`semantica`** en `estados_reserva` para reglas de producto, y claves estables ya definidas (p. ej. disparadores de plantillas, códigos ISO).
- ⚠️ **Deuda conocida:** hoy `reservas.estado_gestion` (y en la práctica muchos flujos con `reservas.estado`) siguen el modelo antiguo por nombre; se está planificando migración. **Hasta migrar:** al tocar esos flujos, preferir resolver vía `estadosService` / `semantica` y **no** añadir nuevos literales de nombres de gestión.
- 📄 **Checklist por archivo:** `TASKS/audit-identificadores-vs-nombres-ui.md`

### Mapeo snake_case → camelCase (CRÍTICO)
- ⚠️ PostgreSQL devuelve `snake_case` — el frontend espera `camelCase`
- ✅ CADA servicio debe tener su función `mapear()` local
- ❌ NUNCA crear un helper de mapeo global
- ⚠️ Un campo no mapeado llega como `undefined` SIN error visible

---

## 4. 🎨 Design System

### Tokens de Color (OBLIGATORIO)

| Uso | Token | PROHIBIDO |
|---|---|---|
| Primario | `primary-*` | `blue-*`, `indigo-*` |
| Error | `danger-*` | `red-*` |
| Éxito | `success-*` | `green-*` |
| Advertencia | `warning-*` | `yellow-*` |
| Botones | `.btn-primary`, `.btn-danger`, etc. | Tailwind ad-hoc |

### Tipografía
- Font: Inter (Google Fonts)
- Escala: `display`, `heading`, `subhead`, `body`, `caption`

---

## 5. 🧩 Modularidad

| Métrica | Límite | Crítico |
|---|---|---|
| Líneas por archivo | 400 max | 700 = refactorizar ya |
| Líneas por función | 60 max | 120 = extraer sub-funciones |
| Exports por archivo | 8 max | 15 = dividir módulos |

### Auditorías Obligatorias
```bash
node scripts/audit-complexity.js    # Después de TODO cambio de código
node scripts/audit-ui.js            # Después de cambios frontend
```

---

## 6. 📁 Estructura del Proyecto

```
staymanager/
├── SHARED_CONTEXT.md      ← ESTE ARCHIVO (fuente de verdad)
├── CLAUDE.md              ← Instrucciones para Claude Code
├── .clinerules            ← Contexto detallado del negocio
├── .agent/workflows/      ← Workflows de Antigravity
│
├── backend/
│   ├── db/
│   │   ├── postgres.js           ← Pool dual (PG o null)
│   │   └── schema-grupo-c.sql    ← Tablas Grupo C
│   ├── services/                 ← Lógica pura (sin req/res)
│   │   ├── reservas.read.js      ← Ejemplo de servicio migrado
│   │   ├── reservas.write.js
│   │   ├── reservas.delete.js
│   │   └── ...
│   ├── routes/
│   │   ├── publicRoutes.js       ← API pública para IA
│   │   └── ...
│   ├── controllers/
│   │   └── publicAiController.js ← Controller público (db lazy init)
│   ├── middleware/
│   │   ├── authMiddleware.js     ← JWT (SPA)
│   │   └── tenantResolver.js    ← Dominio/subdominio (SSR)
│   └── views/                    ← EJS templates (SSR)
│
├── frontend/src/                  ← SPA (Vanilla JS)
│   ├── views/
│   ├── views/components/
│   ├── api.js
│   └── router.js
│
├── TASKS/
│   ├── migration-plan-postgres.md ← Plan completo de migración
│   └── completed.md              ← Historial de tareas
│
└── scripts/
    ├── audit-complexity.js
    ├── audit-ui.js
    └── migrate-colors.js
```

---

## 7. 🤖 Roles de los Agentes

### Antigravity (Claude Opus 4.6 — IDE)
- **Rol**: Arquitecto consultor
- **Hace**: Propone ideas, revisa código, investiga
- **NO hace**: Ejecutar cambios sin aprobación del usuario
- **Memoria**: Knowledge Items en `~/.gemini/antigravity/knowledge/`
- **Antes de proponer cambios**: Lee archivos completos, verifica dependencias

### Claude Code (CLI)
- **Rol**: Desarrollador ejecutor
- **Hace**: Escribe código, ejecuta scripts, hace deploy
- **Usa**: `CLAUDE.md` como instrucciones principales
- **Auditoría**: Ejecuta `audit-complexity.js` y `audit-ui.js` post-cambio

### Flujo de Trabajo Conjunto
```
1. Usuario pide → Antigravity investiga y propone
2. Usuario aprueba → Claude Code ejecuta
3. Claude Code audita → audit-complexity.js + audit-ui.js
4. Si pasa auditoría → git push origin main → Deploy Render
5. Antigravity registra observaciones en SHARED_CONTEXT.md
```

---

## 8. 📝 Observaciones de Agentes

### Antigravity (última actualización: 2026-03-29)

1. **CLAUDE.md desactualizado**: Sigue mencionando Firestore como DB principal. Debe actualizarse para reflejar modo dual PostgreSQL/Firestore.
2. **Public API (`publicAiController.js`)**: Usa `collectionGroup` de Firestore — NO está migrada a PostgreSQL aún. Cuando se migre, el campo `isListed` se vuelve una columna normal y el índice de Firestore ya no es necesario.
3. **Lazy init de `db` en controllers**: En `publicAiController.js`, `const db = require('firebase-admin').firestore()` está DENTRO de cada función para evitar `FirebaseAppError`. Cuando se migre a PostgreSQL, esto se reemplaza por `const pool = require('../db/postgres')`.
4. **Campo `isListed`**: Migrado de `googleHotelData.isListed` (anidado) a `isListed` (raíz) en Firestore. En PostgreSQL será columna `activo` en tabla `propiedades`.
5. **Acuerdo Arquitectura IA (Escalera de Costos Gemma)**: Tras revisar el análisis crítico, emití la contrapropuesta final [acuerdo-arquitectura-ia.md](file:///d:/pmeza/Desarrollos%20Render/staymanager/TASKS/acuerdo-arquitectura-ia.md). **Claude Code:** El diseño técnico oficial es ahora un "Strategy Pattern basado en Enums de Tareas". Revisa el plan de Sprints e inicia el Sprint 1 de inmediato.

#### ✅ COMPLETADO: Rediseño CRM (2026-03-29)

**Vista unificada `/crm`** con 3 tabs:
1. **Pipeline** — Kanban por segmento RFM con sidebar de cliente + generación de cupón individual
2. **Clientes** — Tabla sortable con filtros, segmento RFM inline
3. **Campañas** — Crear + historial unificado con:
   - ✨ Redactor IA (Gemini) — escribe la idea y la IA la redacta
   - 🎟️ Cupones masivos por segmento con límite de uso configurable
   - 📱 Envío WhatsApp (manual, uno a uno)
   - 📧 Envío Email (mailto para quienes tengan email)
   - 📋 Copiar mensaje al portapapeles (otros canales)
   - Preview en vivo con variables [NOMBRE_CLIENTE] y [CUPON_DESCUENTO]

**Perfil del cliente (`/cliente/:id`) mejorado:**
- Badge de segmento RFM + KPI cards (lifetime value, reservas, calificación)
- Timeline cronológico unificado (reservas + comunicaciones fusionados)

**Backend:**
- `POST /api/crm/dashboard` — KPIs en 1 query SQL (reemplaza 3 requests)
- `POST /api/crm/redactar-promocion` — Genera texto con Gemini 2.0 Flash
- `GET /api/crm/campanas/:id/interacciones` — Ahora usa service (antes era Firestore directo en ruta)

**Archivos eliminados**: `crmPromociones.js`, `historialCampanas.js`
**Archivos creados**: `crm.js`, `crm.pipeline.js`, `crm.table.js`, `crm.campaigns.js`

**Cupones**: Sistema completo de cupones con vigencia y multi-uso. Endpoint principal: `POST /crm/cupones`.

#### 🚀 Evolución del Sistema de Cupones (2026-03-29)

**Migración SQL requerida** (archivo: `backend/db/migrations/cupones-evolution.sql`):
```sql
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS vigencia_desde DATE;
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS vigencia_hasta DATE;
CREATE INDEX IF NOT EXISTS idx_cupones_cliente ON cupones(empresa_id, cliente_id) WHERE activo = true;
```

**Regla de validación**: Fechas priman sobre usos. Si `vigencia_hasta` pasó → cupón INVÁLIDO, sin importar usos restantes.

##### Backend — `cuponesService.js` (reescrito)

| Función | Descripción |
|---|---|
| `generarCuponParaCliente(db, empresaId, clienteId, opciones)` | Acepta `{ porcentajeDescuento, usosMaximos, vigenciaDesde, vigenciaHasta }`. Backward-compatible: acepta número simple. |
| `validarCupon(db, empresaId, codigo)` | Valida vigencia (fechas primero) → luego usos |
| `marcarCuponComoUtilizado(tx, db, empresaId, codigo, reservaId, clienteIdUso, queryClient?)` | Incrementa `usos_actuales`, desactiva si alcanzó máximo; `queryClient` opcional (misma transacción PG que el INSERT de reserva web) |
| `obtenerCuponesCliente(db, empresaId, clienteId)` | Cupones activos del cliente (auto-detección en propuestas) |
| `obtenerTodosCupones(db, empresaId)` | Dashboard con JOIN a clientes para nombre |
| `obtenerUsoCupon(db, empresaId, cuponCodigo)` | Reservas donde se aplicó el cupón |

##### Backend — `routes/crm.js` (nuevos endpoints)

| Endpoint | Uso |
|---|---|
| `GET /crm/cupones/todos` | Tab CRM Cupones |
| `GET /crm/cupones/cliente/:clienteId` | Auto-detección en Agregar Propuesta |
| `GET /crm/cupones/:codigo/uso` | Detalle de uso expandible |
| `POST /crm/cupones` | Crear cupón — acepta `usosMaximos, vigenciaDesde, vigenciaHasta` |
| `PUT /crm/cupones/:id` | Editar cupón (descuento, usos, vigencia, activo) |
| `DELETE /crm/cupones/:id` | Eliminar cupón (solo si `usos_actuales = 0`) |

##### Backend — `cuponesService.js` — funciones CRUD adicionales

| Función | Regla |
|---|---|
| `editarCupon(db, empresaId, cuponId, datos)` | UPDATE con COALESCE para campos opcionales. Acepta: `porcentajeDescuento, usosMaximos, vigenciaDesde, vigenciaHasta, activo` |
| `eliminarCupon(db, empresaId, cuponId)` | DELETE solo si `usos_actuales = 0`. Si fue usado, lanza error. Protege integridad de datos. |

##### Frontend — Cambios

**`crm.coupons.js` [NUEVO]**: Tab "🎟️ Cupones" en CRM con:
- Tabla filtrable (Activos/Vencidos/Agotados)
- Botón ✏️ Editar → modal con campos: descuento, usos, vigencia, activo/inactivo
- Botón 📋 Ver detalle → modal con reservas donde se aplicó y montos descontados
- Botón 🗑️ Eliminar → confirm() + DELETE (solo aparece si cupón tiene 0 usos)

**`crm.js`**: Agregado 4º tab "🎟️ Cupones" con lazy-load.

**`cuponesValidator.js`**: Nueva función `detectarCuponCliente(clienteId, callback)` — al seleccionar cliente en Agregar Propuesta, consulta `GET /crm/cupones/cliente/:id` y muestra banner con botón "Aplicar Cupón" mostrando usos restantes y vigencia.

**`propuesta.clientes.js`**: +1 import + llamada a `detectarCuponCliente` al final de `selectClient()`. Cambio mínimo, 8 líneas.

**`propuesta.handlers.js`**: Modal `_abrirModalCrearCupon` expandido con campos de vigencia (desde/hasta) y usos máximos.

**`crm.pipeline.js`**: Sidebar de cliente expandido con inputs de vigencia y usos máximos.

**`crm.campaigns.js`**: Formulario de campañas expandido con vigencia desde/hasta. `_generarCupones()` pasa vigencias al backend.

**Nota sobre `clientes.id`**: La columna `id` de la tabla `clientes` es de tipo `TEXT` (no UUID). Por eso `cupones.cliente_id` se creó como `TEXT` sin FK constraint. El JOIN en `obtenerTodosCupones` funciona correctamente.

**Para Claude Code — Auditar**:
1. Verificar que `cuponesService.js` < 250 líneas y funciones < 60 líneas
2. Que `_abrirModalCrearCupon` limpia listeners con `modal.remove()`
3. Que `crm.coupons.js` sigue el patrón render/setup del CRM
4. Que `eliminarCupon` protege cupones usados (DELETE WHERE usos_actuales=0)
5. Que la migración SQL (`backend/db/migrations/cupones-evolution.sql`) se ejecutó

### Claude Code (última actualización: 2026-03-29)

#### Estado real del sistema de tarifas (nuevo modelo PostgreSQL)

1. **Modelo de tarifas migrado completamente**: Las tablas `temporadas` (catálogo de períodos) y `tarifas` (precio por propiedad × temporada) reemplazan la colección Firestore `tarifas`. Los precios por canal se guardan en `precios_canales` JSONB con Firestore doc IDs como claves (ej: `{ "abc123": { valorCLP: 110000, moneda: "CLP" } }`). Esta es la "fuente del precio" actual.

2. **`calculatePrice` y canales siguen en Firestore**: `_resolverCanalesYDolar` en `calculoValoresService.js` aún consulta Firestore para obtener canales y canal por defecto. Esto es crítico: cualquier `canalId` pasado a `calculatePrice` debe ser un Firestore doc ID, no un UUID de PostgreSQL. Al migrar canales a PostgreSQL, se debe actualizar `_resolverCanalesYDolar` simultáneamente.

3. **Bug corregido — `_cargarTarifasYCanales` en `mensajeService.js`**: Usaba `row.reglas?.fechaInicio` y `row.reglas?.precios` (schema Firestore antiguo) para la ruta PostgreSQL. Corregido para usar `obtenerTarifasParaConsumidores` (query con JOIN a `temporadas`). Canales siempre se obtienen de Firestore para mantener IDs compatibles con `calculatePrice`.

4. **Bug corregido — parsing de fechas DATE en `propuestasService.js`**: `pg` retorna columnas `DATE` como objetos `Date` (no strings). El código original hacía `String(date_obj).split('T')[0]` que fallaba porque `toString()` de un Date no contiene 'T' de separación. Solución: helper `_pgDateToUTC(val)` que maneja ambos casos. El mismo patrón está en `tarifasService.js` (`obtenerTarifasParaConsumidores`) y debe aplicarse a cualquier nuevo servicio que lea columnas DATE de PG.

5. **Lógica de límites de temporadas es correcta**: La comparación `t.fechaInicio <= d && t.fechaTermino >= d` maneja correctamente reservas que cruzan el límite entre temporadas (ej: Mar 31 → noches únicas por temporada). `addDays` de date-fns funciona correctamente con fechas UTC midnight incluso en servidores con timezone UTC-3.

6. **`_buildDetalleCabanas` bug corregido**: Usaba `pricing.totalPriceCLP / propiedades.length` (promedio global) en vez de `precioDetalle.precioTotal` (precio real de cada propiedad). Relevante en propuestas multi-cabaña con precios distintos.

---

## 9. 🚨 Bugs Conocidos y Lecciones

| Bug | Causa Raíz | Prevención |
|---|---|---|
| `FirebaseAppError` al iniciar | `db = firestore()` en top-level de controller | Usar lazy init dentro de funciones |
| `FAILED_PRECONDITION` en collectionGroup | Índice Firestore faltante | Verificar índices antes de deploy |
| `index.js` con código duplicado | Edición parcial corrupta | Siempre leer archivo completo antes de editar |
| Campo `undefined` en frontend | Falta mapeo snake→camel en servicio PG | TODA query PG debe pasar por `mapear()` |
| express-rate-limit warning | Proxy de Render no reconocido | `app.set('trust proxy', 1)` |
| `operator does not exist: text = uuid` en JOIN | Columna TEXT comparada contra UUID en JOIN columna-a-columna | Castear UUID a texto: `ON tabla.id::text = otra.fk_columna` |
| `operator does not exist: text = uuid` en resenas JOIN propiedades | `propiedades.id` es **TEXT slug** (ej: "cabana1"), no UUID. `resenas.propiedad_id` es UUID. Fix: `ON p.id = r.propiedad_id::text` | `propiedades.id` SIEMPRE es TEXT slug, NO UUID. El plan de migración dice UUID pero el código real usa slugify |
