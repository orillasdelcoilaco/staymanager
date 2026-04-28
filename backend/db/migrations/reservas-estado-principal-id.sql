-- reservas.estado_principal_id: FK al catálogo estados_reserva (estado principal, es_gestion = false).
-- Se mantiene reservas.estado como nombre denormalizado (OTA / listados).
-- Ejecutar: node backend/scripts/apply-sql-migration.js db/migrations/reservas-estado-principal-id.sql

ALTER TABLE reservas
    ADD COLUMN IF NOT EXISTS estado_principal_id UUID REFERENCES estados_reserva(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_empresa_estado_principal_id
    ON reservas(empresa_id, estado_principal_id);

UPDATE reservas r
SET estado_principal_id = er.id
FROM estados_reserva er
WHERE r.empresa_id = er.empresa_id
  AND er.es_gestion = false
  AND r.estado IS NOT NULL
  AND btrim(r.estado) <> ''
  AND er.nombre = r.estado
  AND (r.estado_principal_id IS DISTINCT FROM er.id);
