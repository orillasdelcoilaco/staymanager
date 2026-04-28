-- reservas.estado_gestion_id: FK al catálogo estados_reserva (gestión).
-- La columna texto estado_gestion se mantiene en sincronía vía aplicación (UI / listados).

ALTER TABLE reservas
    ADD COLUMN IF NOT EXISTS estado_gestion_id UUID REFERENCES estados_reserva(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_empresa_estado_gestion_id
    ON reservas(empresa_id, estado_gestion_id);

-- Backfill: emparejar por nombre visible actual (solo filas es_gestion).
UPDATE reservas r
SET estado_gestion_id = er.id
FROM estados_reserva er
WHERE r.empresa_id = er.empresa_id
  AND er.es_gestion = true
  AND r.estado_gestion IS NOT NULL
  AND btrim(r.estado_gestion) <> ''
  AND er.nombre = r.estado_gestion
  AND (r.estado_gestion_id IS DISTINCT FROM er.id);
