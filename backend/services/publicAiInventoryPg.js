/**
 * Inventario público para IA (GET /api/public/busqueda-general, /propiedades) en modo PostgreSQL.
 * El controlador legacy usaba solo Firestore → 0 resultados cuando el catálogo vive en PG.
 */
const pool = require('../db/postgres');
const { parseISO, isValid } = require('date-fns');
const { getAvailabilityData } = require('./publicWebsiteService');
const { resolveEmpresaDbId } = require('./resolveEmpresaDbId');

function _normalizeUbicacion(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function _mapRowToAiProperty(row) {
    const meta = row.metadata || {};
    const gh = meta.googleHotelData || {};
    const addr = gh.address || {};
    const calle = addr.street || '';
    const ciudad = addr.city || '';
    const direccionCompleta = `${calle}, ${ciudad}`.replace(/^, /, '').replace(/, $/, '');

    const wd = meta.websiteData || {};
    const enrichedImages = [];
    if (wd.images && typeof wd.images === 'object') {
        Object.values(wd.images).forEach((img) => {
            if (!img) return;
            enrichedImages.push({
                url: img.storagePath || img.url || '',
                description: img.description || img.alt || '',
                tags: img.tags || [],
                category: img.category || 'general',
            });
        });
    }

    const {
        comision,
        costoLimpieza,
        costoLavanderia,
        datosBancarios,
        emailPropietario,
        telefonoPropietario,
        rutPropietario,
        contrato,
        notasInternas,
        ...safeMeta
    } = meta;

    return {
        ...safeMeta,
        id: row.id,
        nombre: row.nombre,
        capacidad: row.capacidad,
        empresa: {
            id: row.empresa_id,
            nombre: row.empresa_nombre || 'Empresa',
            contacto: row.empresa_email || '',
        },
        direccion: direccionCompleta,
        imagenesDestacadas: enrichedImages.filter((i) => i.url).slice(0, 5),
        imagenesCount: enrichedImages.length,
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
    } = query;

    const targetRaw = id || empresaId || null;
    const targetEmpresaId = targetRaw ? await resolveEmpresaDbId(String(targetRaw).trim()) : null;

    let sql = `
        SELECT p.id, p.nombre, p.capacidad, p.metadata, p.empresa_id,
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
    sql += ' ORDER BY e.nombre ASC, p.nombre ASC LIMIT 800';

    const { rows } = await pool.query(sql, params);
    let propiedades = rows.map(_mapRowToAiProperty);

    if (ubicacion) {
        const term = _normalizeUbicacion(ubicacion);
        propiedades = propiedades.filter((p) => {
            const gh = p.googleHotelData || {};
            const addr = gh.address || {};
            const calle = _normalizeUbicacion(addr.street || '');
            const ciudad = _normalizeUbicacion(addr.city || '');
            return calle.includes(term) || ciudad.includes(term);
        });
    }

    if (capacidad) {
        const cap = parseInt(capacidad, 10);
        if (!Number.isNaN(cap) && cap > 0) {
            propiedades = propiedades.filter((p) => (p.capacidad || 0) >= cap);
        }
    }

    if (amenidades) {
        const amenidadesRequeridas = String(amenidades)
            .split(',')
            .map((a) => a.trim().toLowerCase())
            .filter(Boolean);
        propiedades = propiedades.filter((p) => {
            const lista = Array.isArray(p.amenidades) ? p.amenidades : [];
            return amenidadesRequeridas.every((req) =>
                lista.some((a) => String(a).toLowerCase().includes(req))
            );
        });
    }

    if (fechaLlegada && fechaSalida) {
        const start = parseISO(String(fechaLlegada).slice(0, 10) + 'T00:00:00Z');
        const end = parseISO(String(fechaSalida).slice(0, 10) + 'T00:00:00Z');
        if (isValid(start) && isValid(end) && start < end) {
            const empresasUnicas = [...new Set(propiedades.map((p) => p.empresa.id))];
            const disponibleKey = new Set();
            for (const empId of empresasUnicas) {
                const { availableProperties } = await getAvailabilityData(null, empId, start, end);
                for (const ap of availableProperties) {
                    disponibleKey.add(`${empId}::${ap.id}`);
                }
            }
            propiedades = propiedades.filter((p) => disponibleKey.has(`${p.empresa.id}::${p.id}`));
            propiedades.forEach((p) => {
                p.disponible = true;
            });
        }
    }

    if (ordenar === 'precio_asc' || ordenar === 'precio_desc') {
        propiedades.sort((a, b) => {
            const pa = Number(a.precioBase) || 0;
            const pb = Number(b.precioBase) || 0;
            return ordenar === 'precio_asc' ? pa - pb : pb - pa;
        });
    } else if (ordenar === 'rating') {
        propiedades.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }

    const off = parseInt(offset, 10) || 0;
    const lim = parseInt(limit, 10) || 20;
    const paginatedProperties = propiedades.slice(off, off + lim);

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
        },
        data: paginatedProperties,
    };
}

module.exports = { fetchGlobalPublicAiInventoryPostgres };
