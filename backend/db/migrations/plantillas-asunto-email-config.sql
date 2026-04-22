-- Plantillas: asunto de correo y configuración de disparadores (JSONB)
-- node backend/scripts/apply-sql-migration.js db/migrations/plantillas-asunto-email-config.sql

ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS asunto TEXT DEFAULT '';
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT '{}'::jsonb;
