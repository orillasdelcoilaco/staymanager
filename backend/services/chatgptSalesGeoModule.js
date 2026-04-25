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

function buildGeoComercialIa({ ubicacion, meta }) {
    return {
        lat: _num(ubicacion?.lat),
        lng: _num(ubicacion?.lng),
        ciudad: _text(ubicacion?.ciudad) || null,
        region: _text(ubicacion?.region) || null,
        direccion_linea: _text(ubicacion?.direccion_linea) || null,
        pois: _extractPois(meta),
        payload_version: 'geo_ia_v1',
    };
}

module.exports = {
    buildGeoComercialIa,
};

