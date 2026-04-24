/**
 * Inventario público para IA (GET /api/public/busqueda-general, /propiedades) en modo PostgreSQL.
 * El controlador legacy usaba solo Firestore → 0 resultados cuando el catálogo vive en PG.
 */
const pool = require('../db/postgres');
const { resolveEmpresaDbId } = require('./resolveEmpresaDbId');
const { fetchTarifasForEmpresas } = require('../routes/website.shared');
const { enrichPropertyRowsForPublicAi, resolvePrecioNocheReferencia } = require('./publicAiProductSnapshot');
const {
    filterByUbicacion,
    filterByCapacidad,
    filterByAmenidades,
    filterByDisponibilidad,
    sortPropiedades,
} = require('./publicAiInventoryPg.filters');

/**
 * Carga mínima para conectores MCP / ChatGPT (evita ResponseTooLarge).
 * Mantiene solo lo necesario para filtros de ubicación y amenidades en memoria.
 */
function _mapRowToAiPropertyLite(row) {
    const meta = row.metadata || {};
    const gh = meta.googleHotelData || {};
    const addr = gh.address || {};
    const wd = meta.websiteData || {};
    let fotoUrl = '';
    if (wd.cardImage?.storagePath) fotoUrl = String(wd.cardImage.storagePath).trim();
    if (!fotoUrl && wd.images && typeof wd.images === 'object') {
        const flat = Object.values(wd.images).flat().filter(Boolean);
        if (flat[0]?.storagePath) fotoUrl = String(flat[0].storagePath).trim();
    }
    const amRaw = meta.amenidades;
    const amenidadesLista = Array.isArray(amRaw)
        ? amRaw
              .map((a) => (typeof a === 'string' ? a : a?.nombre || ''))
              .filter(Boolean)
              .slice(0, 30)
        : [];

    return {
        id: row.id,
        nombre: row.nombre,
        capacidad: Number(row.capacidad) || 0,
        precioBase: meta.precioBase != null ? Number(meta.precioBase) : null,
        rating: meta.rating != null ? Number(meta.rating) : null,
        empresa: {
            id: row.empresa_id,
            nombre: row.empresa_nombre || 'Empresa',
        },
        ciudad: String(addr.city || addr.locality || '').trim(),
        direccion_corta: [addr.street, addr.city].filter(Boolean).join(', ').slice(0, 140),
        foto_url: fotoUrl,
        googleHotelData: { address: { street: addr.street || '', city: addr.city || '' } },
        amenidades: amenidadesLista,
        _src: row,
    };
}

/**
 * @param {Record<string, string>} query — req.query de getProperties
 * @returns {Promise<{ meta: object, data: object[] }>}
 */
async function fetchGlobalPublicAiInventoryPostgres(query) {
    const {
        id,
        ubicacion,
        capacidad,
        fechaLlegada,
        fechaSalida,
        amenidades,
        ordenar = 'popularidad',
        limit = 20,
        offset = 0,
        empresaId,
        compact: compactRaw,
    } = query;

    const listaCompacta =
        compactRaw !== '0' && compactRaw !== 'false' && String(compactRaw).toLowerCase() !== 'full';

    const targetRaw = id || empresaId || null;
    const targetEmpresaId = targetRaw ? await resolveEmpresaDbId(String(targetRaw).trim()) : null;

    let sql = `
        SELECT p.id, p.nombre, p.capacidad, p.descripcion, p.metadata, p.empresa_id,
               e.nombre AS empresa_nombre, e.email AS empresa_email
        FROM propiedades p
        INNER JOIN empresas e ON e.id = p.empresa_id
        WHERE p.activo = true
          AND COALESCE((p.metadata->'googleHotelData'->>'isListed')::boolean, false) = true
    `;
    const params = [];
    if (targetEmpresaId) {
        params.push(targetEmpresaId);
        sql += ` AND p.empresa_id = $${params.length}`;
    }
    sql += ' ORDER BY e.nombre ASC, p.nombre ASC LIMIT 150';

    const { rows } = await pool.query(sql, params);
    const empIdsTarifas = [...new Set(rows.map((r) => r.empresa_id))];
    const { allTarifas, defaultCanalByEmpresa } = await fetchTarifasForEmpresas(empIdsTarifas);

    let propiedades = rows.map((r) => ({
        ..._mapRowToAiPropertyLite(r),
        __sortPrecio: resolvePrecioNocheReferencia(r, allTarifas, defaultCanalByEmpresa).clp,
    }));

    propiedades = filterByUbicacion(propiedades, ubicacion);
    propiedades = filterByCapacidad(propiedades, capacidad);
    propiedades = filterByAmenidades(propiedades, amenidades);
    propiedades = await filterByDisponibilidad(propiedades, fechaLlegada, fechaSalida);
    propiedades = sortPropiedades(propiedades, ordenar);

    const off = Math.max(parseInt(offset, 10) || 0, 0);
    const limRaw = parseInt(limit, 10) || 20;
    const lim = Math.min(Math.max(limRaw, 1), 30);
    const paginatedLite = propiedades.slice(off, off + lim);
    const srcRows = paginatedLite.map((p) => p._src).filter(Boolean);
    const dataEnriquecida =
        srcRows.length > 0
            ? await enrichPropertyRowsForPublicAi(srcRows, { compact: listaCompacta })
            : [];

    return {
        meta: {
            total: propiedades.length,
            limit: lim,
            offset: off,
            filtros: {
                ubicacion,
                capacidad,
                fechas: { llegada: fechaLlegada, salida: fechaSalida },
                amenidades,
            },
            ordenado_por: ordenar,
            source: 'postgres',
            compact: listaCompacta,
            payload: 'producto_ia_v2',
        },
        data: dataEnriquecida,
    };
}

module.exports = { fetchGlobalPublicAiInventoryPostgres };
