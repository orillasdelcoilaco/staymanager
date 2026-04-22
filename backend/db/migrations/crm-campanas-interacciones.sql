-- CRM: campañas + interacciones (compatible con ids TEXT de empresas/clientes/campanas)
-- Si falla "relation interacciones does not exist" al crear campaña.
--
-- node backend/scripts/apply-sql-migration.js db/migrations/crm-campanas-interacciones.sql

CREATE TABLE IF NOT EXISTS campanas (
    id              TEXT    PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    empresa_id      TEXT    NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

    nombre          TEXT    NOT NULL,
    segmento        TEXT    NOT NULL,
    mensaje         TEXT    NOT NULL,
    autor           TEXT    NOT NULL,
    total_enviados  INTEGER NOT NULL DEFAULT 0,

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

CREATE TABLE IF NOT EXISTS interacciones (
    id              TEXT    PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    empresa_id      TEXT    NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
    campana_id      TEXT    NOT NULL REFERENCES campanas(id)  ON DELETE CASCADE,
    cliente_id      TEXT             REFERENCES clientes(id)  ON DELETE SET NULL,

    cliente_nombre  TEXT    NOT NULL,
    estado          TEXT    NOT NULL DEFAULT 'Enviado'
                    CHECK (estado IN ('Enviado', 'Respondio', 'NoInteresado', 'Reservo', 'SinRespuesta')),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interacciones_campana  ON interacciones(empresa_id, campana_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_cliente  ON interacciones(empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_interacciones_estado   ON interacciones(empresa_id, campana_id, estado);

DO $body$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'create_updated_at_trigger' AND n.nspname = 'public'
    ) THEN
        PERFORM public.create_updated_at_trigger('campanas');
        PERFORM public.create_updated_at_trigger('interacciones');
    END IF;
END $body$;
