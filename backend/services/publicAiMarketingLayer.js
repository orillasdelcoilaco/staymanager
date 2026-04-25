/**
 * Capa comercial determinística para payloads IA (sin LLM): ubicación ampliada, amenities públicas,
 * inventario detallado separado, descripción auto y contexto turístico heurístico.
 */
const { getVerifiedInventory } = require('./propiedadLogicService');
const { sanitizeContextoComercial } = require('./propiedadesMetadataPipeline');

const AMENITY_NORMALIZE = [
    { slug: 'wifi', label: 'WiFi', patterns: [/wifi|wi-?fi|internet|wlan/i] },
    { slug: 'parrilla', label: 'Parrilla / quincho', patterns: [/parrilla|quincho|asado|bbq|grill|barbacoa/i] },
    { slug: 'tinaja', label: 'Tinaja / hot tub', patterns: [/tinaja|hot\s*tub|jacuzzi|hidromasaje/i] },
    { slug: 'chimenea', label: 'Chimenea / salamandra', patterns: [/chimenea|salamandra|estufa\s*a\s*leña/i] },
    { slug: 'cocina_equipada', label: 'Cocina equipada', patterns: [/cocina|horno|microondas|lavavajillas/i] },
    { slug: 'estacionamiento', label: 'Estacionamiento', patterns: [/estacionamiento|parking|garage|cochera/i] },
    { slug: 'sabanas', label: 'Ropa de cama', patterns: [/sabana|sábanas|toalla|blancos/i] },
    { slug: 'tv', label: 'TV / streaming', patterns: [/\btv\b|televisor|smart\s*tv|netflix/i] },
    { slug: 'calefaccion', label: 'Calefacción', patterns: [/calefacción|calefaccion|aire\s*acondicionado|split|heat/i] },
    { slug: 'mascotas', label: 'Mascotas', patterns: [/mascota|pet\s*friendly/i] },
];

const ENTORNO_TAGS = [
    { tag: 'bosque', patterns: [/bosque|arboleda|naturaleza|sendero|árbol/i] },
    { tag: 'rio', patterns: [/río|rio|orilla\s*fluvial|playa\s*fluvial/i] },
    { tag: 'lago', patterns: [/lago|lacustre|orilla\s*del\s*lago/i] },
    { tag: 'montaña', patterns: [/montaña|montana|volcán|volcan|cordillera|andes/i] },
    { tag: 'costa', patterns: [/costa|mar|playa|océano|oceano/i] },
    { tag: 'ciudad', patterns: [/centro|ciudad|urbano|avenida/i] },
];

const TIPO_VIAJE_TAGS = [
    { tag: 'familias', patterns: [/famil|niñ|niño|chicos|grupo/i], minCap: 4 },
    { tag: 'parejas', patterns: [/románt|romantic|honeymoon|luna\s*de\s*miel|privacidad/i] },
    { tag: 'grupos', patterns: [/grupo|amigos|celebraci|evento/i], minCap: 6 },
];

const DESTACADOS_RULES = [
    { text: 'Tinaja o hidromasaje', patterns: [/tinaja|hot\s*tub|jacuzzi|hidromasaje/i] },
    { text: 'Vista al volcán o cordillera', patterns: [/vista.*volcán|vista.*volcan|vista.*cordillera|mirador/i] },
    { text: 'Cerca de lago o río', patterns: [/lago|río a|rio a|\d+\s*min.*lago|\d+\s*min.*río|\d+\s*min.*rio/i] },
    { text: 'Parrilla y espacio exterior', patterns: [/parrilla|quincho|terraza|jardín|jardin/i] },
    { text: 'WiFi de calidad', patterns: [/wifi|fibra|internet/i] },
];

function _haystackParts(meta, row) {
    const parts = [
        row?.nombre,
        row?.descripcion,
        meta?.websiteData?.description,
        meta?.websiteData?.shortDescription,
        meta?.websiteData?.homeIntro,
        meta?.buildContext?.seoDesc,
        meta?.buildContext?.homeIntro,
        Array.isArray(meta?.amenidades)
            ? meta.amenidades.map((a) => (typeof a === 'string' ? a : a?.nombre || '')).join(' ')
            : '',
    ];
    return parts.filter(Boolean).join(' · ');
}

function enrichUbicacionForAi(meta, ubicBase) {
    const u = { ...ubicBase };
    const wd = meta.websiteData || {};
    const extra = wd.address || meta.direccionPublica || meta.address || {};
    const pick = (v) => (v != null && String(v).trim() ? String(v).trim() : '');
    if (!u.direccion) {
        u.direccion =
            pick(extra.streetAddress) ||
            pick(extra.street) ||
            pick(extra.line1) ||
            pick(meta.direccion) ||
            pick(meta.direccionCorta);
    }
    if (!u.ciudad) {
        u.ciudad =
            pick(extra.addressLocality) ||
            pick(extra.city) ||
            pick(meta.ciudad) ||
            pick(meta.localidad);
    }
    if (!u.region) {
        u.region = pick(extra.addressRegion) || pick(extra.region) || pick(meta.region) || pick(meta.regionNombre);
    }
    const bc = meta.buildContext || {};
    if (u.lat == null && bc.latitude != null && Number.isFinite(Number(bc.latitude))) {
        u.lat = Number(bc.latitude);
    }
    if (u.lng == null && bc.longitude != null && Number.isFinite(Number(bc.longitude))) {
        u.lng = Number(bc.longitude);
    }
    const gh = meta.googleHotelData || {};
    if (u.lat == null && gh.latitude != null) u.lat = Number(gh.latitude);
    if (u.lng == null && gh.longitude != null) u.lng = Number(gh.longitude);

    const ub = meta.ubicacion || {};
    if (!u.direccion && ub.direccion) u.direccion = String(ub.direccion).trim();
    if (!u.ciudad && ub.ciudad) u.ciudad = String(ub.ciudad).trim();
    if (!u.region && ub.region) u.region = String(ub.region).trim();
    if (u.lat == null && ub.lat != null && Number.isFinite(Number(ub.lat))) u.lat = Number(ub.lat);
    if (u.lng == null && ub.lng != null && Number.isFinite(Number(ub.lng))) u.lng = Number(ub.lng);
    if (!u.pais && ub.pais) u.pais = String(ub.pais).trim() || null;

    u.direccion_linea = [u.direccion, u.ciudad, u.region].filter(Boolean).join(', ').slice(0, 220);
    return u;
}

function _mergePreferPersisted(persistedArr, fallbackArr, max) {
    const p = (persistedArr || [])
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .slice(0, max);
    if (p.length) return p;
    return (fallbackArr || []).slice(0, max);
}

function matchPatterns(hay, patterns) {
    const h = String(hay || '');
    return patterns.some((re) => re.test(h));
}

/**
 * Lista corta de amenities “de venta” (sin platos/ollas).
 * @param {string[]} mergedLines — salida de merge metadata+inventario
 * @param {string} nombrePropiedad
 */
function deriveAmenidadesPublicas(mergedLines, nombrePropiedad) {
    const hay = `${nombrePropiedad || ''} ${(mergedLines || []).join(' ')}`;
    const out = [];
    const seen = new Set();
    for (const rule of AMENITY_NORMALIZE) {
        if (matchPatterns(hay, rule.patterns)) {
            if (!seen.has(rule.slug)) {
                seen.add(rule.slug);
                out.push(rule.label);
            }
        }
    }
    return out.slice(0, 12);
}

function buildInventarioDetallado(meta, maxItems) {
    const inv = getVerifiedInventory(meta.componentes || []);
    const lim = Math.min(Math.max(maxItems || 15, 1), 40);
    return inv.slice(0, lim).map((it) => {
        const q = it.quantity > 1 ? `${it.quantity}× ` : '';
        return `${q}${it.description}`.trim();
    });
}

function inferContextoTuristico(meta, row, distribucion, amenidadesPublicas) {
    const persisted = sanitizeContextoComercial(meta.contextoComercial) || {
        tipo_viaje: [],
        entorno: [],
        destacados: [],
    };
    const hay = _haystackParts(meta, row);
    const entornoHeur = [];
    for (const r of ENTORNO_TAGS) {
        if (matchPatterns(hay, r.patterns)) entornoHeur.push(r.tag);
    }
    const tipoHeur = [];
    const cap = Number(row?.capacidad) || 0;
    for (const t of TIPO_VIAJE_TAGS) {
        if (!matchPatterns(hay, t.patterns)) continue;
        if (t.minCap && cap < t.minCap) continue;
        tipoHeur.push(t.tag);
    }
    if (!tipoHeur.length && cap >= 5) tipoHeur.push('familias');
    if (!tipoHeur.length && cap > 0 && cap <= 3) tipoHeur.push('parejas');

    const destacadosHeur = [];
    for (const d of DESTACADOS_RULES) {
        if (matchPatterns(hay, d.patterns)) destacadosHeur.push(d.text);
    }
    (amenidadesPublicas || []).forEach((a) => {
        if (/tinaja|hidromasaje|jacuzzi/i.test(a) && !destacadosHeur.some((x) => /tinaja/i.test(x))) {
            destacadosHeur.push('Tinaja o hidromasaje');
        }
    });

    const tipo_viaje = _mergePreferPersisted(persisted.tipo_viaje, tipoHeur, 6);
    const entorno = _mergePreferPersisted(persisted.entorno, entornoHeur, 6);
    let destacados = (persisted.destacados || []).length
        ? persisted.destacados.slice(0, 8)
        : [...new Set(destacadosHeur)].slice(0, 6);

    const tvU = [...new Set(tipo_viaje)].slice(0, 4);
    const tvStr =
        tvU.length === 0
            ? 'huéspedes'
            : tvU.length === 1
              ? tvU[0]
              : `${tvU.slice(0, -1).join(', ')} y ${tvU[tvU.length - 1]}`;

    return {
        tipo_viaje: tvU,
        entorno: [...new Set(entorno)].slice(0, 4),
        destacados: [...new Set(destacados)].slice(0, 6),
        sugerencia_copy:
            destacados[0] || entorno[0]
                ? `Ideal para ${tvStr} que buscan ${entorno[0] || destacados[0] || 'una estadía cómoda'}.`
                : null,
    };
}

/** Normaliza etiqueta de espacio (galería) a categoría conversacional para IA. */
function mapEspacioToTipoIa(espacioLabel, rol) {
    const s = String(espacioLabel || '').toLowerCase();
    if (/dormitor|habitaci|pieza|bedroom/i.test(s)) return 'dormitorio';
    if (/baño|bano|bath/i.test(s)) return 'bano';
    if (/cocina|kitchen/i.test(s)) return 'cocina';
    if (/living|estar|sala/i.test(s)) return 'living';
    if (/terraza|balc[oó]n|balcon|deck|patio/i.test(s)) return 'terraza';
    if (/exterior|jard[ií]n|jardin|quincho|parrilla/i.test(s)) return 'exterior';
    if (/comedor|dining/i.test(s)) return 'comedor';
    if (rol === 'principal') return 'principal';
    return 'general';
}

function buildDescripcionComercialAuto({
    nombre,
    capacidad,
    distribucion,
    amenidades_publicas,
    empresaNombre,
}) {
    const d = distribucion || {};
    const parts = [];
    parts.push(`${nombre || 'Alojamiento'} para hasta ${capacidad || '?'} huéspedes`);
    if (d.dormitorios) parts.push(`${d.dormitorios} dormitorio(s)`);
    if (d.banos) parts.push(`${d.banos} baño(s)`);
    if (amenidades_publicas?.length) {
        parts.push(`Equipamiento destacado: ${amenidades_publicas.slice(0, 8).join(', ')}`);
    }
    if (empresaNombre) parts.push(`Operado por ${empresaNombre}`);
    return parts.join('. ') + '.';
}

module.exports = {
    enrichUbicacionForAi,
    deriveAmenidadesPublicas,
    buildInventarioDetallado,
    inferContextoTuristico,
    buildDescripcionComercialAuto,
    mapEspacioToTipoIa,
};
