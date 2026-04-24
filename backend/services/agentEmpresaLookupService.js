const pool = require('../db/postgres');
const { detectEmpresaIdFromText } = require('../../ai/router/empresaNameDetector');

/**
 * Resuelve texto libre ("Prueba 1", "prueba1") → empresa Postgres para /buscar-empresa.
 * 1) Coincidencia exacta en BD (nombre / subdominio) — evita índice estático desactualizado.
 * 2) Índice estático empresas.json + resolución por id/subdominio.
 * 3) Búsqueda parcial (ILIKE).
 */
async function lookupEmpresaForAgentQuery(q) {
    const trimmed = String(q || '').trim();
    if (!trimmed) return null;

    if (!pool) return null;

    const qn = trimmed.toLowerCase();

    const { rows: exactRows } = await pool.query(
        `SELECT id, nombre FROM empresas
         WHERE LOWER(TRIM(nombre)) = $1
            OR LOWER(TRIM(COALESCE(subdominio, ''))) = $1
         LIMIT 1`,
        [qn]
    );
    if (exactRows[0]) return { id: exactRows[0].id, nombre: exactRows[0].nombre };

    const fromIndex = detectEmpresaIdFromText(trimmed);
    if (fromIndex) {
        const { rows } = await pool.query(
            `SELECT id, nombre FROM empresas
             WHERE id = $1
                OR LOWER(TRIM(COALESCE(subdominio, ''))) = LOWER(TRIM($1::text))
                OR (
                  configuracion->>'websiteSettings' IS NOT NULL
                  AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) > 0
                  AND LOWER(TRIM(configuracion->'websiteSettings'->>'subdomain')) = LOWER(TRIM($1::text))
                )
                OR (
                  configuracion->>'websiteSettings' IS NOT NULL
                  AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) > 0
                  AND LOWER(TRIM(configuracion->'websiteSettings'->'general'->>'subdomain')) = LOWER(TRIM($1::text))
                )
             LIMIT 1`,
            [fromIndex]
        );
        if (rows[0]) return { id: rows[0].id, nombre: rows[0].nombre };
    }

    const like = `%${qn.replace(/\s+/g, '%')}%`;

    const { rows } = await pool.query(
        `SELECT id, nombre, subdominio
         FROM empresas
         WHERE LOWER(TRIM(nombre)) = $1
            OR LOWER(TRIM(COALESCE(subdominio, ''))) = $1
            OR LOWER(nombre) LIKE $2
            OR LOWER(COALESCE(subdominio, '')) LIKE $2
            OR (
              configuracion->>'websiteSettings' IS NOT NULL
              AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) > 0
              AND LOWER(TRIM(configuracion->'websiteSettings'->>'subdomain')) = $1
            )
            OR (
              configuracion->>'websiteSettings' IS NOT NULL
              AND LENGTH(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) > 0
              AND LOWER(TRIM(configuracion->'websiteSettings'->'general'->>'subdomain')) = $1
            )
         ORDER BY
           CASE
             WHEN LOWER(TRIM(COALESCE(subdominio, ''))) = $1 THEN 0
             WHEN LOWER(TRIM(nombre)) = $1 THEN 1
             ELSE 2
           END,
           nombre
         LIMIT 1`,
        [qn, like]
    );
    if (!rows[0]) return null;
    return { id: rows[0].id, nombre: rows[0].nombre };
}

module.exports = { lookupEmpresaForAgentQuery };
