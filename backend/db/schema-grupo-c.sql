-- ============================================================
-- SuiteManager — Schema Grupo C
-- Tablas: galeria, tipos_elemento, tipos_componente,
--         tipos_amenidad, campanas (reemplaza borrador v1),
--         interacciones, comunicaciones
--
-- REQUISITO: schema base v1 ya aplicado
--   (empresas, propiedades, clientes, plantillas, etc.)
--
-- ATENCIÓN: Si ya existe la tabla 'campanas' del borrador v1,
-- ejecutar primero manualmente:
--   DROP TABLE IF EXISTS campanas CASCADE;
-- ============================================================

-- ============================================================
-- GALERÍA DE FOTOS (subcollección de propiedades)
-- Firestore: empresas/{id}/propiedades/{id}/galeria/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS galeria (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID         NOT NULL REFERENCES empresas(id)    ON DELETE CASCADE,
    propiedad_id    UUID         NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,

    original_url    TEXT,                        -- URL de origen externo (null si upload manual)
    storage_path    TEXT,
    storage_url     TEXT,
    thumbnail_url   TEXT,

    espacio         TEXT,                        -- nombre del espacio ("Cocina", "Dormitorio")
    espacio_id      TEXT,                        -- ID del tipoComponente (TEXT: puede ser UUID o FS id)

    confianza       NUMERIC(3,2) DEFAULT 0.20
                    CHECK (confianza >= 0 AND confianza <= 1),
    estado          TEXT         NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('auto', 'manual', 'pendiente', 'descartada')),
    rol             TEXT         NOT NULL DEFAULT 'adicional'
                    CHECK (rol IN ('principal', 'adicional')),

    alt_text        TEXT         DEFAULT '',
    orden           INTEGER      DEFAULT 99,
    origen          TEXT         DEFAULT 'upload_manual',

    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_galeria_propiedad         ON galeria(empresa_id, propiedad_id);
CREATE INDEX IF NOT EXISTS idx_galeria_propiedad_estado  ON galeria(empresa_id, propiedad_id, estado);
CREATE INDEX IF NOT EXISTS idx_galeria_espacio_id        ON galeria(empresa_id, propiedad_id, espacio_id);
CREATE INDEX IF NOT EXISTS idx_galeria_orden             ON galeria(propiedad_id, orden);

SELECT create_updated_at_trigger('galeria');

-- ============================================================
-- TIPOS DE ELEMENTO
-- Firestore: empresas/{id}/tiposElemento/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_elemento (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    nombre                  TEXT    NOT NULL,
    categoria               TEXT    NOT NULL DEFAULT 'Otros',
    icono                   TEXT    DEFAULT '🔹',

    permite_cantidad        BOOLEAN DEFAULT true,
    countable               BOOLEAN DEFAULT false,
    count_value_default     INTEGER DEFAULT 0,
    capacity                INTEGER DEFAULT 0,

    requires_photo          BOOLEAN DEFAULT false,
    photo_quantity          INTEGER DEFAULT 0,
    photo_guidelines        TEXT,

    seo_tags                TEXT[]  DEFAULT '{}',
    sales_context           TEXT,
    schema_type             TEXT    DEFAULT 'Thing',
    schema_property         TEXT    DEFAULT 'amenityFeature',

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_elemento_empresa           ON tipos_elemento(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tipos_elemento_empresa_categoria ON tipos_elemento(empresa_id, categoria);

SELECT create_updated_at_trigger('tipos_elemento');

-- ============================================================
-- TIPOS DE COMPONENTE (espacios de una propiedad)
-- Firestore: empresas/{id}/tiposComponente/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_componente (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    nombre_usuario      TEXT    NOT NULL,
    nombre_normalizado  TEXT    NOT NULL,
    categoria           TEXT    NOT NULL DEFAULT 'Otros',
    icono               TEXT    DEFAULT '🏠',

    descripcion_base    TEXT,
    seo_description     TEXT,

    shot_list           TEXT[]  DEFAULT '{}',
    palabras_clave      TEXT[]  DEFAULT '{}',
    inventario_sugerido JSONB   DEFAULT '[]',   -- [{nombre, cantidad, categoria}]

    origen              TEXT    DEFAULT 'personalizado',

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_componente_empresa           ON tipos_componente(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tipos_componente_empresa_categoria ON tipos_componente(empresa_id, categoria);
CREATE INDEX IF NOT EXISTS idx_tipos_componente_palabras_clave    ON tipos_componente USING GIN (palabras_clave);

SELECT create_updated_at_trigger('tipos_componente');

-- ============================================================
-- TIPOS DE AMENIDAD
-- Firestore: empresas/{id}/tiposAmenidad/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS tipos_amenidad (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    nombre      TEXT    NOT NULL,
    icono       TEXT    DEFAULT '✨',
    categoria   TEXT    NOT NULL,
    descripcion TEXT    DEFAULT '',

    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_amenidad_empresa           ON tipos_amenidad(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tipos_amenidad_empresa_categoria ON tipos_amenidad(empresa_id, categoria);

SELECT create_updated_at_trigger('tipos_amenidad');

-- ============================================================
-- CAMPAÑAS CRM
-- Reemplaza el borrador genérico del schema v1
-- Firestore: empresas/{id}/campanas/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS campanas (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    nombre          TEXT    NOT NULL,
    segmento        TEXT    NOT NULL,
    mensaje         TEXT    NOT NULL,
    autor           TEXT    NOT NULL,
    total_enviados  INTEGER NOT NULL DEFAULT 0,

    -- Contadores denormalizados (UPDATE atómico eficiente vs JSONB)
    cnt_enviado         INTEGER NOT NULL DEFAULT 0 CHECK (cnt_enviado >= 0),
    cnt_respondio       INTEGER NOT NULL DEFAULT 0 CHECK (cnt_respondio >= 0),
    cnt_no_interesado   INTEGER NOT NULL DEFAULT 0 CHECK (cnt_no_interesado >= 0),
    cnt_reservo         INTEGER NOT NULL DEFAULT 0 CHECK (cnt_reservo >= 0),
    cnt_sin_respuesta   INTEGER NOT NULL DEFAULT 0 CHECK (cnt_sin_respuesta >= 0),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanas_empresa       ON campanas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_campanas_empresa_fecha ON campanas(empresa_id, created_at DESC);

SELECT create_updated_at_trigger('campanas');

-- ============================================================
-- INTERACCIONES CRM (un registro por cliente por campaña)
-- Firestore: empresas/{id}/interacciones/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS interacciones (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID    NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
    campana_id      UUID    NOT NULL REFERENCES campanas(id)  ON DELETE CASCADE,
    cliente_id      UUID             REFERENCES clientes(id)  ON DELETE SET NULL,

    cliente_nombre  TEXT    NOT NULL,
    estado          TEXT    NOT NULL DEFAULT 'Enviado'
                    CHECK (estado IN ('Enviado', 'Respondio', 'NoInteresado', 'Reservo', 'SinRespuesta')),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interacciones_campana  ON interacciones(empresa_id, campana_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_cliente  ON interacciones(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_estado   ON interacciones(empresa_id, campana_id, estado);

SELECT create_updated_at_trigger('interacciones');

-- ============================================================
-- COMUNICACIONES (historial de mensajes por cliente)
-- Firestore: empresas/{id}/clientes/{id}/comunicaciones/{id}
-- ============================================================
CREATE TABLE IF NOT EXISTS comunicaciones (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID    NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
    cliente_id      UUID             REFERENCES clientes(id)  ON DELETE SET NULL,

    tipo            TEXT    NOT NULL DEFAULT 'email'
                    CHECK (tipo IN ('email', 'whatsapp', 'sms')),

    evento          TEXT    NOT NULL DEFAULT 'general',
    asunto          TEXT    DEFAULT '',
    destinatario    TEXT    DEFAULT '',

    plantilla_id    UUID             REFERENCES plantillas(id) ON DELETE SET NULL,

    -- Relación con reserva o propuesta (columnas separadas para índice eficiente)
    relacion_tipo   TEXT,    -- 'reserva'|'propuesta'|null
    relacion_id     TEXT,    -- id_reserva_canal o UUID

    estado          TEXT    NOT NULL DEFAULT 'enviado'
                    CHECK (estado IN ('enviado', 'fallido', 'pendiente')),
    message_id      TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- Sin updated_at: comunicaciones son registros de audit inmutables
);

CREATE INDEX IF NOT EXISTS idx_comunicaciones_cliente   ON comunicaciones(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_relacion  ON comunicaciones(empresa_id, relacion_tipo, relacion_id);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_fecha     ON comunicaciones(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunicaciones_evento    ON comunicaciones(empresa_id, evento);
