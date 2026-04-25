function _text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function _clip(value, max) {
    const t = _text(value);
    if (!t) return '';
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function _inferTono({ contextoTuristico, amenidadesEstructuradas, capacidad }) {
    const tags = Array.isArray(contextoTuristico?.tipo_viaje) ? contextoTuristico.tipo_viaje : [];
    const amenities = Array.isArray(amenidadesEstructuradas?.amenidades)
        ? amenidadesEstructuradas.amenidades
        : [];
    if (tags.includes('parejas')) return 'romantico';
    if (amenities.includes('tinaja') || amenities.includes('vista_rio')) return 'lujo';
    if (tags.includes('familias') || Number(capacidad || 0) >= 4) return 'familiar';
    return 'aventura';
}

function buildDescripcionComercialIa({
    row,
    meta,
    descripcionBase,
    contextoTuristico,
    amenidadesEstructuradas,
}) {
    const shortSource =
        meta?.contextoComercial?.descripcion_corta ||
        meta?.websiteData?.shortDescription ||
        descripcionBase ||
        row?.descripcion ||
        '';
    const longSource =
        meta?.contextoComercial?.descripcion_larga ||
        meta?.websiteData?.description ||
        row?.descripcion ||
        descripcionBase ||
        '';
    const tono =
        _text(meta?.contextoComercial?.tono) ||
        _inferTono({
            contextoTuristico,
            amenidadesEstructuradas,
            capacidad: row?.capacidad,
        });

    return {
        descripcion_corta: _clip(shortSource, 220) || null,
        descripcion_larga: _clip(longSource, 1200) || null,
        tono: ['familiar', 'romantico', 'lujo', 'aventura'].includes(tono) ? tono : 'aventura',
        payload_version: 'descripcion_ia_v1',
    };
}

module.exports = {
    buildDescripcionComercialIa,
};

