-- Lista de espera de disponibilidad (recontacto sin cupo)
-- Estados por ID (no por nombre) y registros por empresa.
-- IDs en TEXT (gen_random_uuid()::text) — patrón del proyecto (empresas.id y clientes.id son TEXT).

CREATE TABLE IF NOT EXISTS espera_disponibilidad_estados (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'rgb(107 114 128)',
    orden INTEGER NOT NULL DEFAULT 0,
    es_final BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS espera_disponibilidad (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    empresa_id TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    estado_id TEXT NOT NULL REFERENCES espera_disponibilidad_estados(id),

    propiedad_id_preferida TEXT NULL,
    fecha_llegada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    personas INTEGER NOT NULL CHECK (personas > 0),

    nombre_contacto TEXT NOT NULL,
    apellido_contacto TEXT NOT NULL DEFAULT '',
    telefono_contacto TEXT NOT NULL DEFAULT '',
    email_contacto TEXT NOT NULL,

    consentimiento_contacto BOOLEAN NOT NULL DEFAULT false,
    consentimiento_at TIMESTAMPTZ NULL,

    notificacion_unica_enviada BOOLEAN NOT NULL DEFAULT false,
    notificacion_enviada_at TIMESTAMPTZ NULL,
    notificacion_message_id TEXT NULL,
    notificacion_error TEXT NULL,

    token_hash TEXT NULL,
    token_expira_at TIMESTAMPTZ NULL,
    token_usado_at TIMESTAMPTZ NULL,

    ultimo_match_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fecha_salida > fecha_llegada)
);

CREATE INDEX IF NOT EXISTS idx_espera_disp_empresa_estado
    ON espera_disponibilidad(empresa_id, estado_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_espera_disp_empresa_fechas
    ON espera_disponibilidad(empresa_id, fecha_llegada, fecha_salida);

CREATE INDEX IF NOT EXISTS idx_espera_disp_empresa_cliente
    ON espera_disponibilidad(empresa_id, cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_espera_disp_token_hash
    ON espera_disponibilidad(token_hash)
    WHERE token_hash IS NOT NULL;
