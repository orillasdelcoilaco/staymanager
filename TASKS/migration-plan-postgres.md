# Plan de Migración: Firestore → PostgreSQL

**Fecha:** 2026-03-24
**Estado:** Propuesta — pendiente aprobación
**Alcance:** Reemplazar Firestore con PostgreSQL en el backend. Firebase Auth y Firebase Storage se mantienen en una primera etapa.

---

## 1. Decisión de Stack

### Por qué PostgreSQL y no continuar con Firestore

- Firestore no puede hacer `SUM()`, `GROUP BY`, `JOIN` nativos → todos los KPIs hacen full-scan en Node.js
- Cada empresa con 2.000 reservas = 2.000 lecturas por consulta de KPI
- A 1.000 empresas activas: costo y latencia escalan **linealmente** — puede superar $500/mes solo en lecturas
- Limitación de índices compuestos hace imposibles los filtros multi-campo del panel de reservas
- Transacciones financieras limitadas a 500 documentos → inaceptable para migraciones masivas
- **Imposibilidad de análisis cross-empresa** (ranking, detección de anomalías, BI global)

### Qué se migra en esta fase

| Componente | Acción | Razón |
|---|---|---|
| Firestore (base de datos) | ✅ Migrar a PostgreSQL | Alto impacto, urgente |
| Firebase Auth (autenticación) | ⏸ Mantener por ahora | Funciona a cualquier escala, separar riesgo |
| Firebase Storage (archivos) | ⏸ Mantener por ahora | Separar riesgo, no impacta rendimiento |

### Plataforma elegida: **Supabase Pro ($25/mes)**

**¿Por qué Supabase y no Render PostgreSQL?**

| Criterio | Render PostgreSQL Starter | **Supabase Pro** |
|---|---|---|
| Precio base | $7/mes | $25/mes |
| Connection pooling (PgBouncer) | ❌ No incluido | ✅ Incluido (crítico) |
| Dashboard visual (Studio) | ❌ Solo CLI/psql | ✅ GUI completa |
| pgvector (búsqueda semántica IA) | Instalación manual | ✅ Pre-instalado |
| Row Level Security | Manual | ✅ Integrado en Studio |
| Storage para archivos | ❌ | ✅ (futura migración de Firebase Storage) |
| Auth propia | ❌ | ✅ (futura migración de Firebase Auth) |
| Backups automáticos | ✅ | ✅ |

**Por qué PgBouncer es crítico (no opcional):**
Render Standard PostgreSQL tiene un máximo de 97 conexiones. Con múltiples instancias del servidor Node.js (Render escala horizontalmente), cada instancia crea su propio pool de 20 conexiones. Con 5 instancias = 100 conexiones → **límite superado sin aviso, conexiones rechazadas en producción**. PgBouncer mantiene un pool de conexiones a nivel de base de datos que todas las instancias comparten, resolviendo el problema completamente.

**Costo real proyectado:**
- Render PostgreSQL Standard + PgBouncer separado: $19 + $7 = $26/mes (mismo precio, sin Studio, sin pgvector, sin Storage futuro)
- Supabase Pro: $25/mes con todo incluido → **Supabase gana**

### Cliente PostgreSQL en Node.js: `pg` (node-postgres)

- Sin ORM → SQL directo, máximo control para queries complejas de reportes
- Patrón actual: `module.exports = (db, empresaId, datos) => {}` — `db` pasa a ser un pool de `pg` en lugar de Firestore. La firma de función se mantiene; solo cambia la implementación interna.
- Pool de conexiones: `Pool` de `pg` apuntando al **puerto de PgBouncer de Supabase** (puerto 6543, no 5432)

---

## 2. Clasificación de Datos por Recuperabilidad

Esta clasificación es el principio ordenador de todo el plan. Define qué migrar primero, qué validar con más rigor y qué rollback aplicar si algo falla.

### Grupo A — Configuración (IRREEMPLAZABLE)

Datos que el usuario configuró manualmente y que no están en ningún CSV ni OTA. Si se pierden, no hay forma de recuperarlos automáticamente.

| Tabla | Servicio | Descripción |
|---|---|---|
| `empresas` | `empresaService.js` | Config general, dominio, subdominio, diseño web SSR |
| `usuarios` | `usuariosService.js`, `authService.js` | Accesos y roles |
| `propiedades` | `propiedadesService.js` | Alojamientos, capacidad, descripción, amenidades, espacios, galería |
| `canales` | `canalesService.js` | OTAs configuradas, comisiones, tipo |
| `estados_reserva` | `estadosService.js` | Estados personalizados con semántica |
| `mapeos` | `mapeosService.js` | Mapeos de columnas CSV por canal |
| `mapeos_centrales` | `mapeosCentralesService.js` | Mapeos de integración directa OTA |
| `conversiones` | `conversionesService.js` | Conversiones nombre externo → propiedad interna |
| `tarifas` | `tarifasService.js` | Reglas de precios |
| `plantillas` | `plantillasService.js` | Plantillas de mensajes de gestión |
| `bloqueos` | `bloqueosService.js` | Bloqueos de disponibilidad manuales |
| `ical_feeds` | `icalService.js` | URLs de calendarios externos configurados |

**Estrategia:** Migrar primero, validar con conteo exacto de registros antes de continuar. El rollback de este grupo requiere restaurar desde Firestore.

### Grupo B — Reservas (RECUPERABLE)

Datos transaccionales que pueden re-importarse desde los reportes CSV de las OTAs si la migración falla. El único riesgo de pérdida real es la **bitácora** (notas manuales de gestión).

| Tabla | Servicio | Recuperable si falla |
|---|---|---|
| `reservas` | `reservasService.js` | ✅ Sí — re-importar CSV |
| `historial_cargas` | `historialCargasService.js` | ✅ Sí — se recrea al re-importar |
| `transacciones` | `transaccionesService.js` | ✅ Sí — registros de pago |
| `bitacora` | `mensajeService.js` | ⚠️ No — notas manuales de gestión |

**Estrategia:** Migrar segundo. Si algo falla, el fallback es re-importar los CSV. Exportar la bitácora a JSON antes del cutover como respaldo independiente.

### Grupo C — Features adicionales (MENOR PRIORIDAD)

| Servicios | Recuperable |
|---|---|
| `crmService.js`, `campanasService.js`, `cuponesService.js` | Parcial |
| `presupuestosService.js`, `propuestasService.js` | Parcial |
| `comentariosService.js`, `documentosService.js`, `galeriaService.js` | Depende |
| `analisisFinancieroService.js` | ✅ Se recalcula |

---

## 3. Inventario de Archivos a Migrar

### Servicios por grupo

**Grupo A — Configuración (migrar primero, máxima validación):**
- `empresaService.js`
- `authService.js` + `usuariosService.js`
- `propiedadesService.js`
- `canalesService.js`
- `estadosService.js`
- `mapeosService.js`
- `mapeosCentralesService.js`
- `conversionesService.js`
- `tarifasService.js`
- `plantillasService.js`
- `bloqueosService.js`
- `icalService.js`

**Grupo B — Reservas (migrar segundo, rollback = re-importar CSV):**
- `historialCargasService.js`
- `reservasService.js`
- `sincronizacionService.js` + `procesarYConsolidar.js`
- `transaccionesService.js`
- `mensajeService.js` (bitácora)
- `gestionService.js`
- `kpiService.js`
- `reportesService.js`
- `calendarioService.js`
- `clientesService.js`

**Grupo C — Features adicionales:**
- `crmService.js`, `campanasService.js`, `cuponesService.js`
- `presupuestosService.js`, `propuestasService.js`, `gestionPropuestasService.js`
- `comentariosService.js`, `documentosService.js`, `galeriaService.js`
- `analisisFinancieroService.js`
- Resto de servicios

**No requieren migración (no usan Firestore):**
- `dolarService.js`, `emailService.js`, `storageService.js`
- `mercadopagoService.js`, `imageProcessingService.js`
- Providers de AI

---

## 3. Esquema de Base de Datos PostgreSQL

### Principios de diseño

1. `empresa_id UUID NOT NULL` en **todas** las tablas → mismo aislamiento multi-tenant que Firestore
2. `JSONB` para campos complejos que hoy son objetos anidados (`valores`, `documentos`, `metadata`) → migración gradual, luego se pueden normalizar
3. UUIDs como PK → compatibles con los IDs de Firestore existentes (se puede migrar el mismo ID)
4. `updated_at` con trigger automático → reemplaza `fechaActualizacion: serverTimestamp()`
5. Sin Row Level Security en esta fase → el middleware de Express ya garantiza aislamiento por `empresaId`. RLS se puede agregar después como capa extra de seguridad.

### SQL de creación del esquema

```sql
-- ============================================================
-- SUITEMANAGER — Schema PostgreSQL v1.0
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector: búsqueda semántica IA

-- Función para updated_at automático
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_updated_at_trigger(t TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- EMPRESAS
-- ============================================================
CREATE TABLE empresas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    email           TEXT UNIQUE,
    plan            TEXT DEFAULT 'basico',
    configuracion   JSONB DEFAULT '{}',
    dominio         TEXT,
    subdominio      TEXT UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
SELECT create_updated_at_trigger('empresas');

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
    id              TEXT PRIMARY KEY,        -- Firebase UID (string)
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    nombre          TEXT,
    rol             TEXT DEFAULT 'admin',
    activo          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
SELECT create_updated_at_trigger('usuarios');

-- ============================================================
-- PROPIEDADES (alojamientos)
-- Con columna embedding para búsqueda semántica IA (pgvector)
-- ============================================================
CREATE TABLE propiedades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    capacidad       INTEGER DEFAULT 0,
    num_piezas      INTEGER DEFAULT 0,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT true,
    metadata        JSONB DEFAULT '{}',     -- amenidades, galería, ubicación, etc.
    embedding       vector(1536),           -- OpenAI text-embedding-3-small (1536 dims)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_propiedades_empresa ON propiedades(empresa_id);
CREATE INDEX idx_propiedades_embedding ON propiedades
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
SELECT create_updated_at_trigger('propiedades');

-- ============================================================
-- CANALES (OTAs y venta directa)
-- ============================================================
CREATE TABLE canales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    tipo            TEXT,
    comision        NUMERIC DEFAULT 0,
    activo          BOOLEAN DEFAULT true,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_canales_empresa ON canales(empresa_id);
SELECT create_updated_at_trigger('canales');

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    apellido        TEXT,
    email           TEXT,
    telefono        TEXT,
    pais            TEXT,
    calificacion    INTEGER DEFAULT 3,
    bloqueado       BOOLEAN DEFAULT false,
    motivo_bloqueo  TEXT,
    notas           TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_clientes_email ON clientes(empresa_id, email);
SELECT create_updated_at_trigger('clientes');

-- ============================================================
-- ESTADOS DE RESERVA (configurables por empresa)
-- ============================================================
CREATE TABLE estados_reserva (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    color           TEXT DEFAULT '#cccccc',
    orden           INTEGER DEFAULT 0,
    es_gestion      BOOLEAN DEFAULT false,
    semantica       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_estados_empresa ON estados_reserva(empresa_id);
SELECT create_updated_at_trigger('estados_reserva');

-- ============================================================
-- HISTORIAL DE CARGAS CSV
-- ============================================================
CREATE TABLE historial_cargas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    id_numerico         SERIAL,
    nombre_archivo      TEXT,
    canal_id            UUID REFERENCES canales(id),
    canal_nombre        TEXT,
    fecha_carga         TIMESTAMPTZ DEFAULT NOW(),
    total_procesadas    INTEGER DEFAULT 0,
    total_creadas       INTEGER DEFAULT 0,
    total_actualizadas  INTEGER DEFAULT 0,
    errores             JSONB DEFAULT '[]',
    metadata            JSONB DEFAULT '{}'
);
CREATE INDEX idx_cargas_empresa ON historial_cargas(empresa_id);
CREATE INDEX idx_cargas_fecha ON historial_cargas(empresa_id, fecha_carga DESC);

-- ============================================================
-- RESERVAS (tabla principal)
-- ============================================================
CREATE TABLE reservas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    id_reserva_canal        TEXT,
    id_carga                UUID REFERENCES historial_cargas(id),
    propiedad_id            UUID REFERENCES propiedades(id),
    canal_id                UUID REFERENCES canales(id),
    cliente_id              UUID REFERENCES clientes(id),
    alojamiento_nombre      TEXT,
    canal_nombre            TEXT,
    nombre_cliente          TEXT,
    fecha_llegada           DATE,
    fecha_salida            DATE,
    total_noches            INTEGER,
    fecha_reserva           DATE,
    estado                  TEXT,
    estado_gestion          TEXT,
    moneda                  TEXT DEFAULT 'CLP',
    valores                 JSONB DEFAULT '{}',
    valor_dolar_dia         NUMERIC,
    cantidad_huespedes      INTEGER DEFAULT 0,
    cliente_gestionado      BOOLEAN DEFAULT false,
    ajuste_manual_realizado BOOLEAN DEFAULT false,
    potencial_calculado     BOOLEAN DEFAULT false,
    documentos              JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(empresa_id, id_reserva_canal)
);

CREATE INDEX idx_reservas_empresa ON reservas(empresa_id);
CREATE INDEX idx_reservas_empresa_fechas ON reservas(empresa_id, fecha_llegada, fecha_salida);
CREATE INDEX idx_reservas_estado ON reservas(empresa_id, estado);
CREATE INDEX idx_reservas_estado_gestion ON reservas(empresa_id, estado_gestion);
CREATE INDEX idx_reservas_canal ON reservas(empresa_id, canal_id);
CREATE INDEX idx_reservas_propiedad ON reservas(empresa_id, propiedad_id);
CREATE INDEX idx_reservas_cliente ON reservas(empresa_id, cliente_id);
CREATE INDEX idx_reservas_carga ON reservas(id_carga);
SELECT create_updated_at_trigger('reservas');

-- ============================================================
-- TRANSACCIONES / PAGOS
-- ============================================================
CREATE TABLE transacciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    id_reserva_canal    TEXT NOT NULL,
    tipo                TEXT,
    monto               NUMERIC NOT NULL,
    fecha               TIMESTAMPTZ DEFAULT NOW(),
    descripcion         TEXT,
    metadata            JSONB DEFAULT '{}'
);
CREATE INDEX idx_transacciones_empresa ON transacciones(empresa_id);
CREATE INDEX idx_transacciones_reserva ON transacciones(empresa_id, id_reserva_canal);

-- ============================================================
-- MAPEOS DE COLUMNAS CSV
-- ============================================================
CREATE TABLE mapeos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    canal_id            UUID NOT NULL REFERENCES canales(id) ON DELETE CASCADE,
    campos              JSONB DEFAULT '[]',
    mapeos_de_estado    JSONB DEFAULT '{}',
    formato_fecha       TEXT DEFAULT 'DD/MM/YYYY',
    separador_decimal   TEXT DEFAULT ',',
    configuracion_iva   TEXT DEFAULT 'incluido',
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, canal_id)
);
CREATE INDEX idx_mapeos_empresa ON mapeos(empresa_id);
SELECT create_updated_at_trigger('mapeos');

-- ============================================================
-- MAPEOS CENTRALES
-- ============================================================
CREATE TABLE mapeos_centrales (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    canal_nombre        TEXT NOT NULL,
    campos              JSONB DEFAULT '{}',
    mapeos_de_estado    JSONB DEFAULT '{}',
    formato_fecha       TEXT,
    separador_decimal   TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, canal_nombre)
);
SELECT create_updated_at_trigger('mapeos_centrales');

-- ============================================================
-- CONVERSIONES DE NOMBRES
-- ============================================================
CREATE TABLE conversiones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    canal_id            UUID REFERENCES canales(id) ON DELETE CASCADE,
    nombre_externo      TEXT NOT NULL,
    propiedad_id        UUID REFERENCES propiedades(id),
    UNIQUE(empresa_id, canal_id, nombre_externo)
);
CREATE INDEX idx_conversiones_empresa ON conversiones(empresa_id);

-- ============================================================
-- BLOQUEOS DE DISPONIBILIDAD
-- ============================================================
CREATE TABLE bloqueos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    propiedad_id    UUID REFERENCES propiedades(id),
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    motivo          TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- metadata stores: { todos: bool, alojamientoIds: uuid[], creadoPor: string }
-- propiedad_id = NULL when todos=true or multiple alojamientos (use metadata.alojamientoIds instead)
CREATE INDEX idx_bloqueos_empresa ON bloqueos(empresa_id);
CREATE INDEX idx_bloqueos_propiedad_fechas ON bloqueos(propiedad_id, fecha_inicio, fecha_fin);

-- ============================================================
-- PLANTILLAS DE MENSAJES
-- ============================================================
CREATE TABLE plantillas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    tipo        TEXT,
    texto       TEXT,
    activa      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_plantillas_empresa ON plantillas(empresa_id);
SELECT create_updated_at_trigger('plantillas');

-- ============================================================
-- BITÁCORA DE GESTIÓN
-- ============================================================
CREATE TABLE bitacora (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    id_reserva_canal    TEXT NOT NULL,
    texto               TEXT NOT NULL,
    autor               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bitacora_empresa_reserva ON bitacora(empresa_id, id_reserva_canal);

-- ============================================================
-- TARIFAS
-- ============================================================
CREATE TABLE tarifas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT,
    propiedad_id    UUID REFERENCES propiedades(id),
    reglas          JSONB DEFAULT '{}',
    activa          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tarifas_empresa ON tarifas(empresa_id);
SELECT create_updated_at_trigger('tarifas');

-- ============================================================
-- ICAL FEEDS
-- ============================================================
CREATE TABLE ical_feeds (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    propiedad_id            UUID REFERENCES propiedades(id),
    url_ical                TEXT NOT NULL,
    ultima_sincronizacion   TIMESTAMPTZ,
    activo                  BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ical_empresa ON ical_feeds(empresa_id);

-- ============================================================
-- PRESUPUESTOS / PROPUESTAS
-- ============================================================
CREATE TABLE presupuestos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id      UUID REFERENCES clientes(id),
    propiedad_id    UUID REFERENCES propiedades(id),
    estado          TEXT DEFAULT 'Propuesta',
    datos           JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_presupuestos_empresa ON presupuestos(empresa_id);
SELECT create_updated_at_trigger('presupuestos');

-- ============================================================
-- CRM: CAMPAÑAS Y CUPONES
-- ============================================================
CREATE TABLE campanas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    tipo            TEXT,
    estado          TEXT DEFAULT 'borrador',
    configuracion   JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cupones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo          TEXT NOT NULL,
    descuento       NUMERIC,
    tipo_descuento  TEXT,
    activo          BOOLEAN DEFAULT true,
    usos_maximos    INTEGER,
    usos_actuales   INTEGER DEFAULT 0,
    fecha_vencimiento DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, codigo)
);
```

---

## 4. Patrón de Migración de Código

### El cambio central: cómo se ve antes y después

El patrón actual es perfecto para migrar: todos los servicios reciben `db` como parámetro. Solo cambia lo que hace `db` internamente.

**Antes (Firestore):**
```javascript
const obtenerReservas = async (db, empresaId) => {
    const snap = await db
        .collection('empresas').doc(empresaId)
        .collection('reservas')
        .where('estado', '==', 'Confirmada')
        .get();
    return snap.docs.map(d => d.data());
};
```

**Después (PostgreSQL):**
```javascript
const obtenerReservas = async (db, empresaId) => {
    const { rows } = await db.query(
        `SELECT * FROM reservas WHERE empresa_id = $1 AND estado = 'Confirmada'`,
        [empresaId]
    );
    return rows.map(mapear);   // ← camelCase mapping (ver sección 8)
};
```

### Tabla de equivalencias Firestore → SQL

| Operación Firestore | Equivalente SQL |
|---|---|
| `.collection('reservas').get()` | `SELECT * FROM reservas WHERE empresa_id = $1` |
| `.where('estado', '==', 'X')` | `WHERE estado = 'X'` |
| `.where('fecha', '>=', x).where('fecha', '<=', y)` | `WHERE fecha BETWEEN $2 AND $3` |
| `.orderBy('fecha', 'desc').limit(10)` | `ORDER BY fecha DESC LIMIT 10` |
| `.doc(id).get()` | `WHERE id = $1` |
| `.doc(id).set(datos)` | `INSERT INTO ... ON CONFLICT DO UPDATE` |
| `.doc(id).update(campos)` | `UPDATE ... SET campo = $1 WHERE id = $2` |
| `.doc(id).delete()` | `DELETE FROM ... WHERE id = $1` |
| `FieldValue.serverTimestamp()` | `DEFAULT NOW()` (automático) |
| Full scan + filter en Node.js | `WHERE campo = $1 AND otro = $2` (índice) |
| **Imposible:** `SUM()`, `GROUP BY` | `SELECT SUM(valor), DATE_TRUNC('month', fecha)...` |

### Ejemplo de mejora real: KPI de ingresos por mes

**Antes (Firestore — full scan, cómputo en Node.js):**
```javascript
const snap = await db.collection('empresas').doc(id).collection('reservas').get();
const todas = snap.docs.map(d => d.data());
const porMes = {};
todas.filter(r => r.estado === 'Confirmada').forEach(r => {
    const mes = r.fechaLlegada.substring(0, 7);
    porMes[mes] = (porMes[mes] || 0) + (r.valores?.valorHuesped || 0);
});
// 2.000 documentos leídos para obtener 12 números
```

**Después (PostgreSQL — 1 query, índice):**
```javascript
const { rows } = await db.query(`
    SELECT
        DATE_TRUNC('month', fecha_llegada) AS mes,
        SUM((valores->>'valorHuesped')::NUMERIC) AS ingresos,
        COUNT(*) AS cantidad
    FROM reservas
    WHERE empresa_id = $1
      AND estado = $2
      AND fecha_llegada BETWEEN $3 AND $4
    GROUP BY 1 ORDER BY 1
`, [empresaId, estadoConfirmada, fechaInicio, fechaFin]);
// Resultado: 12 filas, sin transferir 2.000 documentos
```

---

## 5. Fases del Proyecto

### Fase 0 — Preparación (5 días)

- [ ] Crear proyecto en Supabase Pro, región más cercana (São Paulo)
- [ ] Ejecutar el schema SQL completo en Supabase Studio
- [ ] Instalar `pg` en el backend: `npm install pg`
- [ ] Crear `backend/db/postgres.js` — pool de conexiones apuntando a PgBouncer (puerto 6543)
- [ ] Variable de entorno: `DATABASE_URL` con la connection string de Supabase + PgBouncer
- [ ] **Exportar bitácora a JSON** como respaldo independiente antes de cualquier migración
- [ ] Auditar el servidor MCP (puerto 4002) para verificar si tiene conexión Firestore independiente

**Resultado:** Dos bases de datos corren en paralelo. El backend sigue en Firestore.

---

### Fase 1 — Grupo A: Configuración (1.5 semanas) ⭐ PRIORIDAD MÁXIMA

**Objetivo:** Toda la configuración del sistema vive en PostgreSQL y está validada. Sin reservas aún.

Orden por dependencias:
1. `empresas` → `usuarios` (raíz del árbol)
2. `propiedades` (alojamientos, amenidades, espacios, galería, ubicación)
3. `canales`
4. `estados_reserva`
5. `mapeos` + `mapeosCentrales` + `conversiones`
6. `tarifas` + `plantillas` + `bloqueos`
7. `ical_feeds`

**Validación obligatoria al terminar cada servicio:**
```bash
# Contar registros en Firestore vs PostgreSQL — deben ser iguales
node scripts/validar-migracion.js --coleccion=propiedades --empresaId=XXX
```

**Cutover parcial Fase 1:** cuando todos los servicios del Grupo A pasen validación, se puede hacer un cutover parcial del sistema de configuración. Las rutas de reservas siguen en Firestore.

---

### Fase 2 — Grupo B: Reservas (1.5 semanas)

**Objetivo:** Las reservas, historial de cargas, KPIs y reportes funcionan en PostgreSQL.

Orden por dependencias:
1. `historial_cargas`
2. `clientes`
3. `reservas`
4. `transacciones` + `bitacora`
5. `sincronizacionService` + `procesarYConsolidar`
6. `gestionService`
7. `kpiService` (el que más gana con SQL)
8. `reportesService`
9. `calendarioService`

**Rollback de este grupo:** si algo falla después del cutover, re-importar los CSV desde las OTAs. La bitácora se restaura desde el JSON exportado en Fase 0.

---

### Fase 3 — Grupo C: Features (1 semana)

- `crm`, `campanas`, `cupones`
- `presupuestos`, `propuestas`, `gestionPropuestas`
- `comentarios`, `documentos`, `galería`
- Servicios restantes

---

### Fase 4 — Cutover final y validación (3 días)

1. **Exportar bitácora** a JSON (segunda vez, con datos actualizados)
2. Script de migración corre con datos frescos de Firestore → PostgreSQL
3. **Verificación de integridad Grupo A:** contar registros en ambas bases, los totales deben coincidir exactamente
4. **Verificación Grupo B:** comparar suma de `valorHuesped` en Firestore vs PostgreSQL por empresa
5. Cutover: cambiar variable de entorno `DB_BACKEND=postgres` → reinicio del servidor
6. Monitoreo 48h: logs de errores, queries lentas, funcionalidad
7. Firestore en modo read-only durante 30 días (no borrar hasta confirmar estabilidad)

---

### Fase 5 — Optimización Post-Migración (ongoing)

- Agregar índices según queries lentas detectadas con `pg_stat_statements`
- Normalizar campos JSONB consultados frecuentemente (ej: `valores->>'valorHuesped'` → columna directa)
- Evaluar migración de Firebase Storage → Supabase Storage (separado)
- Cargar embeddings iniciales de propiedades para habilitar búsqueda semántica

---

## 6. Código Base: Pool de Conexiones

### `backend/db/postgres.js` (nuevo archivo)

```javascript
// backend/db/postgres.js
// IMPORTANTE: Apuntar al puerto de PgBouncer (6543), NO al puerto directo (5432)
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,     // Supabase session-mode URL (puerto 6543)
    ssl: { rejectUnauthorized: false },             // Supabase requiere SSL
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
    console.error('[PostgreSQL] Error inesperado en cliente idle:', err.message);
});

module.exports = pool;
```

### `backend/index.js` — cambio de inicialización

```javascript
// Antes:
const admin = require('firebase-admin');
db = admin.firestore();

// Después (cuando la migración esté completa):
const db = require('./db/postgres.js');
// El resto de las rutas y servicios no cambian su firma
```

---

## 7. Implicancias en el SSR (Sitio Web Público)

El SSR es el camino crítico: cada request de un visitante pasa por `tenantResolver.js` para identificar la empresa por dominio/subdominio. Con Firestore, esto era una lectura por request. Con PostgreSQL, el riesgo es el mismo pero la solución es más limpia.

### Cambio requerido en `tenantResolver.js`

**Problema:** Si la base de datos tiene un pico de latencia o falla, el sitio web de TODAS las empresas queda caído.

**Solución: Cache LRU con TTL de 5 minutos**

```javascript
// backend/services/tenantResolver.js
const { LRUCache } = require('lru-cache');   // npm install lru-cache

const tenantCache = new LRUCache({
    max: 500,               // máximo 500 dominios en cache
    ttl: 5 * 60 * 1000,   // 5 minutos
});

async function resolverTenant(db, dominio) {
    const cached = tenantCache.get(dominio);
    if (cached) return cached;

    const { rows } = await db.query(
        `SELECT id, nombre, configuracion, subdominio, dominio
         FROM empresas
         WHERE dominio = $1 OR subdominio = $1
         LIMIT 1`,
        [dominio]
    );

    if (rows[0]) tenantCache.set(dominio, rows[0]);
    return rows[0] || null;
}
```

### Mejora real en la query de disponibilidad

La consulta de disponibilidad del motor de reservas (SSR) era imposible de hacer eficientemente en Firestore. Con PostgreSQL:

```sql
-- Fechas bloqueadas para una propiedad (reservas confirmadas + bloqueos manuales)
SELECT fecha_llegada, fecha_salida FROM reservas
WHERE propiedad_id = $1
  AND estado NOT IN ('Cancelada', 'No Presentado')
  AND fecha_salida > NOW()::DATE

UNION ALL

SELECT fecha_inicio, fecha_fin FROM bloqueos
WHERE propiedad_id = $1
  AND fecha_fin > NOW()::DATE;
```

Una query, un índice, resultado en < 10ms. Antes era: leer todas las reservas de la propiedad, filtrar en Node.js.

---

## 8. Implicancias en IA y Agentes

### 8.1 Problema crítico: snake_case vs camelCase

PostgreSQL devuelve columnas en `snake_case` (`fecha_llegada`, `nombre_cliente`). Todo el frontend y los contratos de ChatGPT Actions esperan `camelCase` (`fechaLlegada`, `nombreCliente`). **Si no se mapea en cada servicio, el sistema se rompe silenciosamente** — los campos llegan `undefined` sin error visible.

**Patrón obligatorio en TODOS los servicios migrados:**

```javascript
// backend/services/reservasService.js — helper de mapeo
function mapear(row) {
    if (!row) return null;
    return {
        id:                     row.id,
        empresaId:              row.empresa_id,
        idReservaCanal:         row.id_reserva_canal,
        idCarga:                row.id_carga,
        propiedadId:            row.propiedad_id,
        canalId:                row.canal_id,
        clienteId:              row.cliente_id,
        alojamientoNombre:      row.alojamiento_nombre,
        canalNombre:            row.canal_nombre,
        nombreCliente:          row.nombre_cliente,
        fechaLlegada:           row.fecha_llegada?.toISOString?.().split('T')[0] || row.fecha_llegada,
        fechaSalida:            row.fecha_salida?.toISOString?.().split('T')[0] || row.fecha_salida,
        totalNoches:            row.total_noches,
        estado:                 row.estado,
        estadoGestion:          row.estado_gestion,
        moneda:                 row.moneda,
        valores:                row.valores || {},
        valorDolarDia:          row.valor_dolar_dia,
        cantidadHuespedes:      row.cantidad_huespedes,
        clienteGestionado:      row.cliente_gestionado,
        ajusteManualRealizado:  row.ajuste_manual_realizado,
        documentos:             row.documentos || {},
        fechaCreacion:          row.created_at,
        fechaActualizacion:     row.updated_at,
    };
}

const obtenerReservas = async (db, empresaId) => {
    const { rows } = await db.query(
        'SELECT * FROM reservas WHERE empresa_id = $1',
        [empresaId]
    );
    return rows.map(mapear);    // ← siempre mapear antes de retornar
};
```

**Regla:** Cada servicio migrado debe tener su función `mapear()` local. No crear un helper global — cada tabla tiene sus propios campos.

### 8.2 Auditoría requerida: Servidor MCP (puerto 4002)

El servidor MCP es un subproceso independiente que puede tener su propia inicialización de Firestore. **Antes del cutover, verificar:**

```bash
# ¿El MCP tiene su propio admin.initializeApp()?
grep -r "initializeApp\|firestore()\|admin.firestore" backend/mcp/ 2>/dev/null || \
grep -r "initializeApp\|firestore()\|admin.firestore" backend/routes/mcp* 2>/dev/null
```

Si el MCP inicializa Firestore de forma independiente, debe migrarse por separado con su propio pool de `pg`. Si recibe `db` como parámetro del servidor principal, se migra automáticamente.

### 8.3 pgvector: Búsqueda Semántica de Propiedades

Con el embedding en la tabla `propiedades`, los agentes de IA pueden responder consultas como "¿qué cabañas tienen jacuzzi y vista al lago para 6 personas?" sin depender de filtros exactos.

**Flujo de indexación (una vez por propiedad nueva o editada):**

```javascript
// backend/services/propiedadesService.js — indexar embedding
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function indexarEmbedding(db, propiedadId, propiedad) {
    const texto = [
        propiedad.nombre,
        propiedad.descripcion,
        (propiedad.metadata?.amenidades || []).join(', '),
        `capacidad: ${propiedad.capacidad} personas`,
        `${propiedad.numPiezas} piezas`,
    ].filter(Boolean).join('. ');

    const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texto,
    });
    const vector = res.data[0].embedding;

    await db.query(
        `UPDATE propiedades SET embedding = $1 WHERE id = $2`,
        [`[${vector.join(',')}]`, propiedadId]
    );
}
```

**Búsqueda semántica desde el agente:**

```javascript
async function buscarPropiedadesSimilares(db, empresaId, consulta, limite = 5) {
    const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: consulta,
    });
    const vector = `[${res.data[0].embedding.join(',')}]`;

    const { rows } = await db.query(`
        SELECT id, nombre, descripcion, capacidad,
               1 - (embedding <=> $1::vector) AS similitud
        FROM propiedades
        WHERE empresa_id = $2
          AND activo = true
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
    `, [vector, empresaId, limite]);

    return rows;
}
```

**Disponibilidad en tiempo real combinada con semántica:**

```javascript
// El agente puede combinar las dos capabilities en una sola respuesta:
// 1. buscarPropiedadesSimilares → top 5 propiedades relevantes semánticamente
// 2. Para cada una, verificar disponibilidad con la query SQL de la sección 7
// Resultado: "Encontré 2 cabañas con jacuzzi disponibles para tus fechas"
```

---

## 9. Análisis Crítico — Qué nos Perjudica el Cambio

Este es el análisis honesto de los riesgos y costos reales de la migración. No hay migración gratis.

### 9.1 Congelamiento de features: 4-5 semanas

Durante la migración, el equipo de desarrollo no puede avanzar en features nuevas con seguridad. Cualquier feature nueva que toque la capa de datos tiene dos caminos: esperar a que la migración termine (retraso) o desarrollarse dos veces, una en Firestore y otra en PostgreSQL (doble trabajo). **Este es el costo más alto y el más subestimado.**

**Mitigación:** Identificar qué features están en vuelo hoy y completarlas ANTES de iniciar Fase 1. No empezar la migración con PRs abiertos que toquen servicios del Tier 1.

### 9.2 51 funciones `mapear()` que pueden fallar silenciosamente

El mapeo camelCase ↔ snake_case es la trampa más peligrosa de toda la migración. Un campo mal mapeado (ej: `valores` no se transforma, `totalNoches` queda como `undefined`) no lanza una excepción — simplemente llega `undefined` al frontend, que lo renderiza como vacío. El bug puede pasar pruebas manuales y ser invisible hasta que un usuario reporta que "el total de noches no aparece".

**Riesgo concreto:** Los campos financieros (`valorHuesped`, `comision`, `valorAnfitrion`) son JSONB anidado. Si el mapeo los transforma mal, los KPIs dan cero sin error. **Esto puede afectar decisiones financieras reales de los clientes.**

**Mitigación:** Para cada servicio migrado, crear una prueba de integración que verifica que los campos críticos no son `undefined`. Especialmente: `valores.valorHuesped`, `fechaLlegada`, `fechaSalida`, `estado`.

### 9.3 El servidor MCP es una caja negra

No se sabe con certeza qué hace el MCP (puerto 4002) con Firestore. Podría:
- Tener su propio `admin.initializeApp()` independiente
- Mantener listeners (`onSnapshot`) que no tienen equivalente en PostgreSQL
- Usar colecciones que no están en los 51 servicios catalogados

Si el MCP usa Firestore directamente y no se migra, el sistema tendrá **dos fuentes de verdad** después del cutover: PostgreSQL para el SPA y Firestore para el MCP. Los datos pueden divergir silenciosamente.

**Mitigación:** La Fase 0 incluye auditoría obligatoria del MCP antes de cualquier código de migración.

### 9.4 No hay `onSnapshot`: los listeners de tiempo real desaparecen

Firestore ofrece `onSnapshot()` — suscripciones en tiempo real que actualizan la UI automáticamente cuando cambian los datos. PostgreSQL no tiene este mecanismo nativo. Si alguna parte del sistema actual usa `onSnapshot`, se rompe y debe reemplazarse con polling manual o WebSockets (complejidad adicional no contemplada en este plan).

**Acción previa:** Buscar todos los usos de `onSnapshot` en el backend antes de iniciar la migración:
```bash
grep -r "onSnapshot" backend/
```

### 9.5 JSONB: datos inconsistentes heredados de Firestore

El campo `valores` en Firestore no tiene schema fijo. Algunas reservas viejas pueden tener `valorHuesped` como string (`"150000"`), otras como número (`150000`), otras sin el campo. En Firestore esto era invisible — cada documento era independiente. En PostgreSQL con el cast `(valores->>'valorHuesped')::NUMERIC`, un string con formato inválido o un campo ausente hace fallar la query completa.

**Mitigación:** El script de migración debe normalizar todos los campos JSONB antes de insertar. Después de la migración, auditar con:
```sql
SELECT id, valores->>'valorHuesped' AS vh
FROM reservas
WHERE empresa_id = 'X'
  AND (valores->>'valorHuesped') !~ '^[0-9]+(\.[0-9]+)?$';
```

### 9.6 Costo real de Supabase a escala

Supabase Pro ($25/mes) incluye 8GB de storage de base de datos y 50GB de transferencia. A 1.000 empresas con 2.000 reservas cada una = 2 millones de reservas. Estimando 2KB por fila (con JSONB): **~4GB solo en la tabla reservas**. Esto entra en el plan Pro sin costo extra.

**El costo adicional real:** Supabase cobra $0.125/GB adicional por encima de 8GB. A plena escala (1.000 empresas activas), el costo puede subir a $40-60/mes — manejable, pero debe contemplarse en el modelo de negocio desde ahora.

### 9.7 Curva de aprendizaje si el equipo es NoSQL-oriented

Firestore perdona errores de schema — un campo mal nombrado simplemente no existe. PostgreSQL falla con `column does not exist`. Si el equipo no está familiarizado con SQL, las primeras semanas de migración serán lentas y habrá errores de sintaxis, tipos de datos, y transacciones.

**Esto no es un problema técnico — es un problema de velocidad.** Las estimaciones de 4-5 semanas asumen experiencia básica con SQL. Sin ella, puede ser el doble.

### 9.8 Resumen de riesgos por prioridad

| Riesgo | Probabilidad | Impacto | Urgencia de mitigación |
|---|---|---|---|
| Campo financiero mal mapeado → KPI incorrecto | Alta | Crítico | Antes de Fase 1 |
| MCP con Firestore independiente | Media | Alto | Fase 0 obligatorio |
| JSONB con tipos inconsistentes | Alta | Medio | Script de migración |
| onSnapshot usado en producción | Baja | Alto | Auditoría previa |
| Congelamiento de features 4-5 semanas | Certeza | Alto | Planificación |
| Costo Supabase a escala | Media | Bajo | Modelo de negocio |

---

## 10. Script de Migración de Datos

### `scripts/migrate-from-firestore.js`

```javascript
// scripts/migrate-from-firestore.js
// Exporta datos de Firestore e importa a PostgreSQL
// Ejecutar UNA VEZ durante el cutover

const admin = require('firebase-admin');
const { Pool } = require('pg');

const db_fs  = admin.firestore();
const db_pg  = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrarEmpresas() {
    const snap = await db_fs.collection('empresas').get();
    for (const doc of snap.docs) {
        const d = doc.data();
        await db_pg.query(
            `INSERT INTO empresas (id, nombre, email, configuracion)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
            [doc.id, d.nombre, d.email, JSON.stringify(d.configuracion || {})]
        );
        await migrarReservas(doc.id);
        await migrarClientes(doc.id);
    }
}

async function migrarReservas(empresaId) {
    const snap = await db_fs
        .collection('empresas').doc(empresaId)
        .collection('reservas').get();

    for (const doc of snap.docs) {
        const d = doc.data();
        // Normalizar valorHuesped a número
        const valores = d.valores || {};
        if (typeof valores.valorHuesped === 'string') {
            valores.valorHuesped = parseFloat(valores.valorHuesped.replace(/[^0-9.]/g, '')) || 0;
        }
        await db_pg.query(
            `INSERT INTO reservas (
                id, empresa_id, id_reserva_canal, propiedad_id, canal_id, cliente_id,
                alojamiento_nombre, canal_nombre, nombre_cliente,
                fecha_llegada, fecha_salida, total_noches,
                estado, estado_gestion, moneda, valores, valor_dolar_dia,
                cantidad_huespedes, cliente_gestionado, ajuste_manual_realizado,
                documentos, created_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
             ON CONFLICT (empresa_id, id_reserva_canal) DO NOTHING`,
            [
                doc.id, empresaId,
                d.idReservaCanal, d.alojamientoId, d.canalId, d.clienteId,
                d.alojamientoNombre, d.canalNombre, d.nombreCliente,
                d.fechaLlegada, d.fechaSalida, d.totalNoches,
                d.estado, d.estadoGestion, d.moneda || 'CLP',
                JSON.stringify(valores), d.valorDolarDia,
                d.cantidadHuespedes || 0,
                d.clienteGestionado || false, d.ajusteManualRealizado || false,
                JSON.stringify(d.documentos || {}),
                d.fechaCreacion?.toDate?.() || new Date()
            ]
        );
    }
    console.log(`✅ Reservas empresa ${empresaId}: ${snap.size} documentos`);
}

migrarEmpresas().then(() => {
    console.log('✅ Migración completa');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error en migración:', err);
    process.exit(1);
});
```

---

## 11. Plan de Rollback por Grupo

El rollback no es binario — cada grupo de datos tiene su propio procedimiento.

### Rollback Grupo A (Configuración)

| Escenario | Acción |
|---|---|
| Falla durante migración (antes de cutover) | No hacer cutover. Firestore sigue activo. |
| Falla dentro de las 24h del cutover | Cambiar `DB_BACKEND=firestore` → reinicio inmediato. Datos de config en PostgreSQL se descartan. |
| Falla después de 48h | Requiere auditoría manual. Comparar campo a campo Firestore vs PostgreSQL para identificar diferencias. |

**Este es el rollback más costoso.** Si la config se corrompe en PostgreSQL y Firestore ya está en read-only, se pierde el trabajo de configuración hecho después del cutover. Por eso Fase 1 requiere validación con conteo exacto antes de proceder.

### Rollback Grupo B (Reservas)

| Escenario | Acción |
|---|---|
| Falla durante migración | No hacer cutover. Re-importar CSV desde OTAs cuando sea necesario. |
| Falla después del cutover | Re-importar todos los CSV de cada canal para cada empresa. Tiempo estimado: 2-4 horas. |
| Pérdida de bitácora | Restaurar desde el JSON exportado en Fase 0. Se pierden las notas creadas después del cutover. |

**Este rollback es manejable.** Las reservas vuelven a un estado limpio desde los reportes originales. La única pérdida real son las notas de la bitácora posteriores al cutover — aceptable.

### Procedimiento general

- **Antes del cutover (cualquier grupo):** Firestore sigue siendo la fuente de verdad. Rollback = no hacer el cutover.
- **Cutover siempre en horario de baja actividad:** domingo 03:00 AM horario Chile.
- **Firestore en modo read-only durante 30 días** después del cutover final — no borrar hasta confirmar estabilidad completa.

---

## 12. Estimación de Tiempos

| Fase | Duración estimada | Depende de |
|---|---|---|
| Fase 0: Preparación + exportar bitácora + auditoría MCP | 5 días | — |
| Fase 1: Grupo A — Configuración (12 servicios) | 8 días | Fase 0 |
| Cutover parcial Fase 1 (config en PostgreSQL) | 1 día | Fase 1 validada |
| Fase 2: Grupo B — Reservas (10 servicios) | 8 días | Fase 1 |
| Fase 3: Grupo C — Features (15 servicios) | 5 días | Fase 2 |
| Fase 4: Cutover final | 3 días | Fases 1-3 completas |
| **Total** | **~4-5 semanas** | — |

El cutover parcial después de Fase 1 es opcional pero recomendado: pone la configuración en producción temprano, donde cualquier bug se detecta con datos reales antes de migrar las reservas.

---

## 13. Beneficios concretos post-migración

| Métrica | Firestore (actual) | PostgreSQL + Supabase |
|---|---|---|
| Tiempo KPI dashboard (1 empresa, 2k reservas) | 2-4 seg | 50-200 ms |
| Costo a 1.000 empresas activas | $400-600+/mes | ~$25-60/mes |
| Queries complejas de reportes | Full scan en Node | SQL en base de datos |
| Filtros multi-campo | Parcialmente client-side | Índice compuesto |
| Búsqueda semántica IA | Imposible | pgvector nativo |
| Transacciones financieras atómicas | 500 doc max | ACID ilimitado |
| Disponibilidad SSR (tenantResolver) | Lectura BD por request | Cache LRU + 1 query |
| Dashboard visual de datos | Firebase Console (limitado) | Supabase Studio (SQL directo) |

---

## Decisión recomendada

**Iniciar Fase 0 esta semana, con dos condiciones:**

1. **Completar las features en vuelo antes de empezar Fase 1.** La Fase 0 (preparación) puede correr en paralelo, pero la Fase 1 (migración de servicios core) requiere freeze de features en los servicios del Tier 1.

2. **Auditar el MCP en Fase 0 antes de escribir cualquier código de migración.** Si el MCP tiene dependencias de Firestore no mapeadas, el plan de migración cambia.

La ventana de oportunidad es ahora — hay pocas empresas activas y pocos datos reales. El esfuerzo de 4-5 semanas hoy evita una migración de 3+ meses con datos financieros reales de 1.000 empresas en producción.
