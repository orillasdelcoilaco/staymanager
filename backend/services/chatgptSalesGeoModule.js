function _num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function _text(v) {
    return String(v || '').trim();
}

function _extractPois(meta) {
    const fuentes = [
        meta?.puntosInteres,
        meta?.pois,
        meta?.contextoComercial?.pois,
        meta?.googleHotelData?.pois,
    ];
    for (const src of fuentes) {
        if (!Array.isArray(src)) continue;
        const out = src
            .map((p) => ({
                nombre: _text(p?.nombre || p?.name),
                distancia_km: _num(p?.distancia_km ?? p?.distance_km),
                tiempo_min: _num(p?.tiempo_min ?? p?.minutes),
                tipo: _text(p?.tipo || p?.type) || null,
            }))
            .filter((p) => p.nombre)
            .slice(0, 8);
        if (out.length) return out;
    }
    return [];
}

function _poisDesdeDestacados(contextoTuristico) {
    const dest = Array.isArray(contextoTuristico?.destacados) ? contextoTuristico.destacados : [];
    return dest
        .map((d) => _text(d))
        .filter(Boolean)
        .slice(0, 6)
        .map((nombre) => ({
            nombre,
            distancia_km: null,
            tiempo_min: null,
            tipo: 'destacado_complejo',
        }));
}

function buildGeoComercialIa({ ubicacion, meta, contextoTuristico }) {
    const poisMetadata = _extractPois(meta);
    const pois = poisMetadata.length ? poisMetadata : _poisDesdeDestacados(contextoTuristico);
    return {
        lat: _num(ubicacion?.lat),
        lng: _num(ubicacion?.lng),
        ciudad: _text(ubicacion?.ciudad) || null,
        region: _text(ubicacion?.region) || null,
        direccion_linea: _text(ubicacion?.direccion_linea) || null,
        pois,
        payload_version: 'geo_ia_v1',
    };
}

module.exports = {
    buildGeoComercialIa,
};

