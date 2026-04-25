const { getVerifiedInventory } = require('./propiedadLogicService');

const AMENITY_RULES = [
    { code: 'wifi', patterns: [/wifi|wi-?fi|internet|wlan/i] },
    { code: 'tinaja', patterns: [/tinaja|hot\s*tub|jacuzzi|hidromasaje/i] },
    { code: 'quincho', patterns: [/quincho|parrilla|bbq|barbacoa|asado|grill/i] },
    { code: 'pet_friendly', patterns: [/pet\s*friendly|mascota|mascotas/i] },
    { code: 'rio', patterns: [/r[ií]o|river|ribera|fluvial/i] },
    { code: 'piscina', patterns: [/piscina|pool|pileta|alberca|swimming/i] },
    { code: 'aire_acondicionado', patterns: [/aire\s*acondicionado|ac\b|climatiz/i] },
    { code: 'vista_rio', patterns: [/vista.*r[ií]o|river\s*view/i] },
];

function _toText(value) {
    if (value == null) return '';
    return String(value).trim();
}

function _metaAmenidadesText(meta) {
    const list = Array.isArray(meta?.amenidades) ? meta.amenidades : [];
    return list
        .map((a) => (typeof a === 'string' ? a : a?.nombre || ''))
        .filter(Boolean)
        .join(' ');
}

function _inventorySummary(meta) {
    const inv = getVerifiedInventory(meta?.componentes || []);
    return inv
        .map((it) => `${it.quantity || 1} ${_toText(it.description)}`)
        .filter(Boolean)
        .join(' ');
}

function _matchCodes(haystack) {
    const out = [];
    for (const rule of AMENITY_RULES) {
        if (rule.patterns.some((re) => re.test(haystack))) out.push(rule.code);
    }
    return out;
}

function _countBeds(meta) {
    const inv = getVerifiedInventory(meta?.componentes || []);
    let total = 0;
    inv.forEach((it) => {
        const desc = _toText(it.description).toLowerCase();
        if (!desc) return;
        if (!/(cama|bed|litera|sofa\s*cama|fut[oó]n)/i.test(desc)) return;
        const qty = Number(it.quantity);
        total += Number.isFinite(qty) && qty > 0 ? qty : 1;
    });
    return total > 0 ? total : null;
}

function _resolveDormitorios(meta, distribucion) {
    const d = Number(distribucion?.dormitorios);
    if (Number.isFinite(d) && d >= 0) return d;
    const md = Number(meta?.dormitorios);
    if (Number.isFinite(md) && md >= 0) return md;
    return 0;
}

function _resolveBanos(meta, distribucion) {
    const b = Number(distribucion?.banos);
    if (Number.isFinite(b) && b >= 0) return b;
    const mb = Number(meta?.banos);
    if (Number.isFinite(mb) && mb >= 0) return mb;
    return 0;
}

function buildAmenidadesEstructuradas({
    row,
    meta,
    amenidades = [],
    amenidadesPublicas = [],
    inventarioDetallado = [],
    distribucion = {},
    mergedRules = null,
    contextoTuristico = null,
}) {
    const destacadosCtx = Array.isArray(contextoTuristico?.destacados)
        ? contextoTuristico.destacados.join(' ')
        : '';
    const haystack = [
        _toText(row?.nombre),
        _toText(row?.descripcion),
        _toText(meta?.websiteData?.description),
        _toText(meta?.websiteData?.shortDescription),
        _toText(meta?.contextoComercial?.descripcion_corta),
        _toText(meta?.contextoComercial?.descripcion_larga),
        _metaAmenidadesText(meta),
        Array.isArray(amenidades) ? amenidades.join(' ') : '',
        Array.isArray(amenidadesPublicas) ? amenidadesPublicas.join(' ') : '',
        Array.isArray(inventarioDetallado) ? inventarioDetallado.join(' ') : '',
        destacadosCtx,
        _inventorySummary(meta),
    ]
        .filter(Boolean)
        .join(' ');

    const codes = new Set(_matchCodes(haystack));
    if (mergedRules?.admiteMascotas === 'si') codes.add('pet_friendly');

    return {
        amenidades: Array.from(codes),
        atributos: {
            dormitorios: _resolveDormitorios(meta, distribucion),
            banos: _resolveBanos(meta, distribucion),
            camas: _countBeds(meta),
        },
        payload_version: 'amenidades_ia_v1',
    };
}

module.exports = {
    buildAmenidadesEstructuradas,
};

