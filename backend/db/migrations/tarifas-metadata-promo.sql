-- node backend/scripts/apply-sql-migration.js db/migrations/tarifas-metadata-promo.sql
-- Ofertas por temporada/propiedad (display SSR) en JSONB sin alterar valorHuesped del motor de canales.

ALTER TABLE tarifas ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
