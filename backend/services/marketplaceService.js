// backend/services/marketplaceService.js
// Queries CROSS-TENANT para el marketplace público suitemanagers.com
const pool = require('../db/postgres');

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'suitemanagers.com';

function mapearPropiedad(row) {
    const titulo = row.website_h1 || row.home_h1 || row.nombre;

    return {
        id: row.id,
        nombre: row.nombre,
        titulo,
        capacidad: parseInt(row.capacidad) || 0,
        empresaId: row.empresa_id,
        empresaNombre: row.empresa_nombre,
        subdominio: (row.subdominio || '').toLowerCase(),
        fotoUrl: row.foto_portada || null,
        rating: row.rating ? parseFloat(parseFloat(row.rating).toFixed(1)) : null,
        numResenas: parseInt(row.num_resenas) || 0,
        precioDesde: row.precio_desde ? parseInt(row.precio_desde) : null,
        url: `https://${(row.subdominio || '').toLowerCase()}.${PLATFORM_DOMAIN}/propiedad/${row.id}`,
        tienePromoTarifa: false,
        promoTarifaPctMax: 0,
    };
}

const QUERY_BASE = `
    SELECT
        p.id,
        p.nombre,
        p.capacidad,
        p.metadata->>'buildContext' IS NOT NULL AS has_context,
        p.metadata->'buildContext'->'narrativa'->>'homeH1' AS home_h1,
        p.metadata->'websiteData'->>'h1' AS website_h1,
        e.id AS empresa_id,
        e.nombre AS empresa_nombre,
        e.subdominio,
        (
            SELECT storage_url FROM galeria
            WHERE propiedad_id = p.id AND storage_url IS NOT NULL
            ORDER BY
                CASE rol WHEN 'portada' THEN 0 ELSE 1 END,
                CASE espacio WHEN 'Exterior' THEN 0
                             WHEN 'Terraza' THEN 1
                             WHEN 'Living' THEN 2
                             ELSE 3 END,
                orden ASC NULLS LAST
            LIMIT 1
        ) AS foto_portada,
        ROUND(AVG(r.punt_general)::numeric, 1) AS rating,
        COUNT(r.id) AS num_resenas,
        MIN(t.precio_base) AS precio_desde
    FROM propiedades p
    JOIN empresas e ON p.empresa_id = e.id
    LEFT JOIN resenas r ON r.propiedad_id = p.id AND r.estado = 'publicada'
    LEFT JOIN tarifas t ON t.propiedad_id = p.id
    WHERE p.activo = true
      AND e.subdominio IS NOT NULL
      AND e.subdominio != ''
`;

// Normaliza texto eliminando acentos para búsqueda tolerante
function normalizarTexto(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// translate() en PG para remover acentos sin extensión unaccent
const PG_NORMALIZE = `translate(LOWER(%COL%), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')`;
function pgNorm(col) { return PG_NORMALIZE.replace(/%COL%/g, col); }

function buildMarketplaceOrderBy(sort) {
    const s = String(sort || '').toLowerCase().trim();
    if (s === 'valor') return 'precio_desde ASC NULLS LAST, rating DESC NULLS LAST, num_resenas DESC, p.nombre';
    if (s === 'valor_desc') return 'precio_desde DESC NULLS LAST, rating DESC NULLS LAST, num_resenas DESC, p.nombre';
    if (s === 'rating') return 'rating DESC NULLS LAST, num_resenas DESC, p.nombre';
    return 'rating DESC NULLS LAST, num_resenas DESC, p.nombre';
}

const obtenerPropiedadesParaMarketplace = async ({ busqueda = '', personas = 0, fechaIn = null, fechaOut = null, limit = 40, sort = null } = {}) => {
    if (!pool) return [];

    const params = [];
    let filtros = '';

    if (busqueda) {
        const q = normalizarTexto(busqueda);
        params.push(`%${q}%`);
        const idx = params.length;
        filtros += ` AND (
            ${pgNorm('p.nombre')} LIKE $${idx}
            OR ${pgNorm("p.metadata->'buildContext'->'narrativa'->>'homeH1'")} LIKE $${idx}
            OR ${pgNorm('e.nombre')} LIKE $${idx}
        )`;
    }

    if (personas > 0) {
        params.push(personas);
        filtros += ` AND p.capacidad >= $${params.length}`;
    }

    if (fechaIn && fechaOut) {
        params.push(fechaIn);
        const idxIn = params.length;
        params.push(fechaOut);
        const idxOut = params.length;
        filtros += `
          AND NOT EXISTS (
            SELECT 1 FROM bloqueos b
            WHERE b.propiedad_id = p.id
              AND b.fecha_inicio < $${idxOut}::date
              AND b.fecha_fin > $${idxIn}::date
          )
          AND NOT EXISTS (
            SELECT 1 FROM reservas rv
            WHERE rv.propiedad_id = p.id
              AND rv.fecha_llegada < $${idxOut}::date
              AND rv.fecha_salida > $${idxIn}::date
              AND rv.estado NOT IN ('cancelada', 'rechazada')
          )`;
    }

    params.push(limit);
    const orderBy = buildMarketplaceOrderBy(sort);
    const { rows } = await pool.query(
        `${QUERY_BASE}${filtros}
         GROUP BY p.id, p.nombre, p.capacidad, p.metadata, e.id, e.nombre, e.subdominio
         ORDER BY ${orderBy}
         LIMIT $${params.length}`,
        params
    );

    return rows.map(mapearPropiedad);
};

const obtenerDestacados = async (limit = 6) => {
    if (!pool) return [];
    const { rows } = await pool.query(
        `${QUERY_BASE}
         GROUP BY p.id, p.nombre, p.capacidad, p.metadata, e.id, e.nombre, e.subdominio
         HAVING COUNT(r.id) >= 3 AND ROUND(AVG(r.punt_general)::numeric, 1) >= 4.5
         ORDER BY rating DESC, num_resenas DESC
         LIMIT $1`,
        [limit]
    );
    return rows.map(mapearPropiedad);
};

const contarPorEmpresa = async () => {
    if (!pool) return [];
    const { rows } = await pool.query(`
        SELECT e.nombre, e.subdominio, COUNT(p.id) AS total
        FROM empresas e
        JOIN propiedades p ON p.empresa_id = e.id AND p.activo = true
        WHERE e.subdominio IS NOT NULL AND e.subdominio != ''
        GROUP BY e.id, e.nombre, e.subdominio
        ORDER BY total DESC
    `);
    return rows;
};

module.exports = {
    obtenerPropiedadesParaMarketplace,
    obtenerDestacados,
    contarPorEmpresa,
    buildMarketplaceOrderBy,
    PLATFORM_DOMAIN,
};
