-- Ampliar valores permitidos de comunicaciones.estado (huésped abrió / respondió).
-- Ejecutar una vez en cada base PostgreSQL del producto.

ALTER TABLE comunicaciones DROP CONSTRAINT IF EXISTS comunicaciones_estado_check;

ALTER TABLE comunicaciones
    ADD CONSTRAINT comunicaciones_estado_check
    CHECK (estado IN ('enviado', 'fallido', 'pendiente', 'recibido', 'leido'));
