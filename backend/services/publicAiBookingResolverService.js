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

async function findPropiedadByCatalogId(pool, catalogId, empresaIds) {
    const needle = String(catalogId || '').trim();
    if (!needle) return null;
    if (!empresaIds?.length) return null;

    const { rows } = await pool.query(
        `SELECT id, nombre, capacidad, metadata, empresa_id::text AS empresa_id
           FROM propiedades
          WHERE activo = true
            AND empresa_id::text = ANY($2::text[])
            AND (
                id::text = $1::text
                OR lower(COALESCE(metadata->>'catalog_id', '')) = lower($1::text)
                OR lower(COALESCE(metadata->>'catalogId', '')) = lower($1::text)
                OR lower(COALESCE(metadata->>'slug', '')) = lower($1::text)
                OR lower(COALESCE(metadata->'websiteData'->>'slug', '')) = lower($1::text)
            )
          ORDER BY
            CASE WHEN id::text = $1::text THEN 0 ELSE 1 END,
            id::text ASC
          LIMIT 1`,
        [needle, empresaIds]
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
        return { ok: false, code: 'PROPERTY_NOT_FOUND', empresa_ids_probados: empresaIds };
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
    findPropiedadByCatalogId,
    resolveBookingUnitForIa,
};

