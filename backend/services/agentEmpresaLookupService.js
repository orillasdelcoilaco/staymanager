const pool = require('../db/postgres');
const { detectEmpresaIdFromText } = require('../../ai/router/empresaNameDetector');

/**
 * Resuelve texto libre ("Prueba 1", "prueba1") → empresa Postgres para /buscar-empresa.
 * 1) Coincidencia exacta en BD (nombre / subdominio) — evita índice estático desactualizado.
 * 2) Índice estático empresas.json + resolución por id/subdominio.
 * 3) Búsqueda parcial (ILIKE).
 */
function mapEmpresaRow(row) {
    if (!row) return null;
    const hasDefaultChannel = !!row.has_default_channel;
    const hasTarifas = Number(row.tarifas_totales || 0) > 0;
    return {
        id: row.id,
        nombre: row.nombre,
        ready_for_sales: hasDefaultChannel && hasTarifas,
        diagnostico_tarifas: {
            canal_por_defecto_configurado: hasDefaultChannel,
            tarifas_totales: Number(row.tarifas_totales || 0),
        },
    };
}

async function lookupEmpresaForAgentQuery(q) {
    const trimmed = String(q || '').trim();
    if (!trimmed) return null;

    if (!pool) return null;

    const qn = trimmed.toLowerCase();

    const { rows: exactRows } = await pool.query(
        `SELECT e.id,
                e.nombre,
                e.updated_at,
                EXISTS (
                  SELECT 1
                    FROM canales c
                   WHERE c.empresa_id::text = e.id::text
                     AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
                ) AS has_default_channel,
                (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) AS tarifas_totales
           FROM empresas e
         WHERE LOWER(TRIM(nombre)) = $1
            OR LOWER(TRIM(COALESCE(subdominio, ''))) = $1
            OR LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) = $1
            OR LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) = $1
         ORDER BY
           CASE
             WHEN (
               EXISTS (
                 SELECT 1
                   FROM canales c
                  WHERE c.empresa_id::text = e.id::text
                    AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
               )
               AND (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) > 0
             ) THEN 0
             ELSE 1
           END,
           CASE
             WHEN LOWER(TRIM(COALESCE(subdominio, ''))) = $1 THEN 0
             WHEN LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) = $1 THEN 1
             WHEN LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) = $1 THEN 2
             WHEN LOWER(TRIM(nombre)) = $1 THEN 3
             ELSE 4
           END,
           updated_at DESC NULLS LAST
         LIMIT 1`,
        [qn]
    );
    if (exactRows[0]) return mapEmpresaRow(exactRows[0]);

    const fromIndex = detectEmpresaIdFromText(trimmed);
    if (fromIndex) {
        const { rows } = await pool.query(
            `SELECT e.id,
                    e.nombre,
                    EXISTS (
                      SELECT 1
                        FROM canales c
                       WHERE c.empresa_id::text = e.id::text
                         AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
                    ) AS has_default_channel,
                    (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) AS tarifas_totales
               FROM empresas e
             WHERE e.id = $1
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
             ORDER BY
               CASE
                 WHEN (
                   EXISTS (
                     SELECT 1
                       FROM canales c
                      WHERE c.empresa_id::text = e.id::text
                        AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
                   )
                   AND (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) > 0
                 ) THEN 0
                 ELSE 1
               END,
               e.updated_at DESC NULLS LAST
             LIMIT 1`,
            [fromIndex]
        );
        if (rows[0]) return mapEmpresaRow(rows[0]);
    }

    const like = `%${qn.replace(/\s+/g, '%')}%`;

    const { rows } = await pool.query(
        `SELECT e.id,
                e.nombre,
                e.subdominio,
                e.updated_at,
                EXISTS (
                  SELECT 1
                    FROM canales c
                   WHERE c.empresa_id::text = e.id::text
                     AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
                ) AS has_default_channel,
                (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) AS tarifas_totales
         FROM empresas e
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
             WHEN (
               EXISTS (
                 SELECT 1
                   FROM canales c
                  WHERE c.empresa_id::text = e.id::text
                    AND LOWER(COALESCE(c.metadata->>'esCanalPorDefecto', 'false')) = 'true'
               )
               AND (SELECT COUNT(*)::int FROM tarifas t WHERE t.empresa_id::text = e.id::text) > 0
             ) THEN 0
             ELSE 1
           END,
           CASE
             WHEN LOWER(TRIM(COALESCE(subdominio, ''))) = $1 THEN 0
             WHEN LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) = $1 THEN 1
             WHEN LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) = $1 THEN 2
             WHEN LOWER(TRIM(nombre)) = $1 THEN 3
             ELSE 4
           END,
           updated_at DESC NULLS LAST,
           nombre
         LIMIT 1`,
        [qn, like]
    );
    if (!rows[0]) return null;
    return mapEmpresaRow(rows[0]);
}

module.exports = { lookupEmpresaForAgentQuery };
