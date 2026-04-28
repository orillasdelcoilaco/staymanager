-- Metadatos JSONB en temporadas (slug estable para importador, etc.).
-- node backend/scripts/apply-sql-migration.js db/migrations/temporadas-metadata.sql

ALTER TABLE temporadas
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
