const { parseISO, isValid } = require('date-fns');
const { sqlReservaPrincipalSemanticaIgual } = require('./estadosService');

function buildEmpresaIdCandidates(empresaRaw, empresaId) {
    const out = [];
    const add = (v) => {
        const s = String(v || '').trim();
        if (!s) return;
        if (!out.includes(s)) out.push(s);
    };
    add(empresaRaw);
    add(empresaId);
    return out;
}

/**
 * Genera variantes de catalog_id para tolerar inconsistencias UI (cabana-10 vs cabana10)
 * y alinear con ID Google Hotels (casa-10) guardado en metadata.googleHotelData.hotelId.
 * Orden: entrada original primero, luego variantes más genéricas.
 */
function expandCatalogIdCandidates(raw) {
    const s0 = String(raw || '').trim();
    if (!s0) return [];

    const out = [];
    const seen = new Set();
    const add = (v) => {
        const t = String(v || '').trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        out.push(t);
    };

    add(s0);
    const lower = s0.toLowerCase();
    if (lower !== s0) add(lower);

    const collapsed = lower.replace(/[-_\s]+/g, '');
    if (collapsed && collapsed !== lower) add(collapsed);

    const tail = collapsed.match(/^(.+?)(\d+)$/);
    if (tail) {
        const stemRaw = tail[1];
        const num = tail[2];
        const stemNorm = stemRaw.toLowerCase().replace(/ñ/g, 'n').replace(/[-_\s]/g, '');
        if (stemNorm === 'cabana' || stemNorm === 'casa') {
            for (const p of ['cabana', 'cabaña', 'casa']) {
                add(`${p}-${num}`);
                add(`${p}${num}`);
            }
        }
    }

    return out;
}

async function findPropiedadByCatalogId(pool, catalogId, empresaIds) {
    const needles = expandCatalogIdCandidates(catalogId);
    if (!needles.length || !empresaIds?.length) return null;

    const { rows } = await pool.query(
        `SELECT s.id, s.nombre, s.capacidad, s.metadata, s.empresa_id
           FROM (
                  SELECT p.id,
                         p.nombre,
                         p.capacidad,
                         p.metadata,
                         p.empresa_id::text AS empresa_id,
                         MIN(n.ord)::int AS match_ord
                    FROM propiedades p
              INNER JOIN unnest($1::text[]) WITH ORDINALITY AS n(needle, ord) ON (
                         p.id::text = n.needle
                      OR lower(COALESCE(p.metadata->>'catalog_id', '')) = lower(n.needle)
                      OR lower(COALESCE(p.metadata->>'catalogId', '')) = lower(n.needle)
                      OR lower(COALESCE(p.metadata->>'slug', '')) = lower(n.needle)
                      OR lower(COALESCE(p.metadata->'websiteData'->>'slug', '')) = lower(n.needle)
                      OR lower(COALESCE(p.metadata->'googleHotelData'->>'hotelId', '')) = lower(n.needle)
                     )
                   WHERE p.activo = true
                     AND p.empresa_id::text = ANY($2::text[])
                   GROUP BY p.id, p.nombre, p.capacidad, p.metadata, p.empresa_id
                ) s
          ORDER BY s.match_ord ASC, s.id::text ASC
          LIMIT 1`,
        [needles, empresaIds]
    );
    return rows[0] || null;
}

async function resolveBookingUnitForIa({
    pool,
    empresaRaw,
    empresaId,
    catalogId,
    checkin,
    checkout,
    personas = 1,
}) {
    const empresaIds = buildEmpresaIdCandidates(empresaRaw, empresaId);
    const prop = await findPropiedadByCatalogId(pool, catalogId, empresaIds);
    if (!prop) {
        return {
            ok: false,
            code: 'PROPERTY_NOT_FOUND',
            empresa_ids_probados: empresaIds,
            catalog_id_candidatos: expandCatalogIdCandidates(catalogId),
        };
    }

    const capacidad = Number(prop.capacidad || 0);
    if (capacidad > 0 && Number(personas || 1) > capacidad) {
        return {
            ok: false,
            code: 'NO_CAPACITY',
            booking_id: String(prop.id),
            capacidad,
        };
    }

    const inicio = parseISO(String(checkin || '').slice(0, 10) + 'T00:00:00Z');
    const fin = parseISO(String(checkout || '').slice(0, 10) + 'T00:00:00Z');
    if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
        return { ok: false, code: 'INVALID_DATES' };
    }

    const { rows: conflictos } = await pool.query(
        `SELECT 1
           FROM reservas r
          WHERE r.empresa_id::text = $1::text
            AND r.propiedad_id::text = $2::text
            AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
            AND r.fecha_llegada < $4::date
            AND r.fecha_salida > $3::date
          LIMIT 1`,
        [String(prop.empresa_id), String(prop.id), String(checkin).slice(0, 10), String(checkout).slice(0, 10)]
    );

    return {
        ok: true,
        booking_id: String(prop.id),
        catalog_id: String(catalogId),
        empresa_id: String(prop.empresa_id),
        nombre: prop.nombre || null,
        metadata: prop.metadata && typeof prop.metadata === 'object' ? prop.metadata : {},
        capacidad,
        disponible: conflictos.length === 0,
    };
}

module.exports = {
    buildEmpresaIdCandidates,
    expandCatalogIdCandidates,
    findPropiedadByCatalogId,
    resolveBookingUnitForIa,
};

