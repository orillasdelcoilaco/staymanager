-- Unicidad de identidad de empresa (nombre y subdominio efectivo).
-- Regla: la llave técnica es empresas.id; nombre/subdominio son atributos editables,
-- pero deben ser únicos para evitar ambigüedad en IA/SSR.

BEGIN;

-- 1) Normalización de nombres (trim + espacios).
UPDATE empresas
SET nombre = regexp_replace(trim(nombre), '\s+', ' ', 'g')
WHERE nombre IS NOT NULL
  AND nombre <> regexp_replace(trim(nombre), '\s+', ' ', 'g');

-- 2) Resolver duplicados de nombre manteniendo el más reciente sin cambios.
WITH ranked AS (
    SELECT
        id,
        nombre,
        row_number() OVER (
            PARTITION BY lower(trim(nombre))
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS rn
    FROM empresas
    WHERE trim(COALESCE(nombre, '')) <> ''
)
UPDATE empresas e
SET nombre = concat(e.nombre, ' #', left(e.id, 6)),
    updated_at = NOW()
FROM ranked r
WHERE e.id = r.id
  AND r.rn > 1;

-- 3) Normalizar subdominio de columna (minúscula, alfanumérico + guión, max 63).
UPDATE empresas
SET subdominio = left(
    regexp_replace(
        regexp_replace(lower(trim(subdominio)), '[^a-z0-9-]+', '-', 'g'),
        '-{2,}', '-', 'g'
    ),
    63
)
WHERE subdominio IS NOT NULL
  AND trim(subdominio) <> '';

UPDATE empresas
SET subdominio = NULL
WHERE subdominio IS NOT NULL
  AND trim(subdominio) = '';

-- 4) Crear índices únicos case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_nombre_ci
ON empresas ((lower(trim(nombre))))
WHERE trim(COALESCE(nombre, '')) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_subdominio_ci
ON empresas ((lower(trim(subdominio))))
WHERE trim(COALESCE(subdominio, '')) <> '';

-- 5) Unicidad para subdominio legacy en JSON websiteSettings.general.subdomain.
CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_ws_general_subdomain_ci
ON empresas ((lower(trim(configuracion->'websiteSettings'->'general'->>'subdomain'))))
WHERE trim(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', '')) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_ws_subdomain_ci
ON empresas ((lower(trim(configuracion->'websiteSettings'->>'subdomain'))))
WHERE trim(COALESCE(configuracion->'websiteSettings'->>'subdomain', '')) <> '';

COMMIT;
