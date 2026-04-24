const pool = require('../db/postgres');

/**
 * Resuelve subdominio / id / websiteSettings.subdomain → empresas.id (Postgres).
 * Sin pool o sin coincidencia devuelve el input.
 */
async function resolveEmpresaDbId(empresaId) {
    if (!pool || !empresaId) return empresaId;
    const key = String(empresaId).trim();
    if (!key) return empresaId;
    const { rows } = await pool.query(
        `SELECT id FROM empresas
         WHERE id = $1
            OR LOWER(TRIM(subdominio)) = LOWER($1)
            OR (
              configuracion->>'websiteSettings' IS NOT NULL
              AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) > 0
              AND LOWER(TRIM(configuracion->'websiteSettings'->>'subdomain')) = LOWER($1)
            )
            OR (
              configuracion->>'websiteSettings' IS NOT NULL
              AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) > 0
              AND LOWER(TRIM(configuracion->'websiteSettings'->'general'->>'subdomain')) = LOWER($1)
            )
         LIMIT 1`,
        [key]
    );
    return rows[0]?.id || empresaId;
}

module.exports = { resolveEmpresaDbId };
