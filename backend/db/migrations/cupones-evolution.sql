-- Migración: Evolución de cupones
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna cliente_id (TEXT porque clientes.id es TEXT)
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS cliente_id TEXT;

-- 2. Agregar vigencias (opcionales, NULL = sin vencimiento)
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS vigencia_desde DATE;
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS vigencia_hasta DATE;

-- 3. Índice para buscar cupones por cliente
CREATE INDEX IF NOT EXISTS idx_cupones_cliente ON cupones(empresa_id, cliente_id) WHERE activo = true;
