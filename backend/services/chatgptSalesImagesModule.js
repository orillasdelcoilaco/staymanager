function _normText(v) {
    return String(v || '').trim();
}

function _inferTipo({ espacio, tipoIa, alt }) {
    const hay = `${_normText(espacio)} ${_normText(tipoIa)} ${_normText(alt)}`.toLowerCase();
    const ti = String(tipoIa || '').toLowerCase().trim();

    if (ti === 'tinaja' || /tinaja|jacuzzi|hidromasaje|hot\s*tub/i.test(hay)) return 'tinaja';
    if (ti === 'piscina' || /piscina|pileta|pool|alberca|swimming/i.test(hay)) return 'piscina';
    if (ti === 'vista' || /vista|mirador|panor[aá]mica|panoramic/i.test(hay)) return 'vista';
    if (ti === 'parrilla' || ti === 'terraza' || ti === 'exterior' || /quincho|parrilla|bbq|terraza|patio|deck|jard[ií]n|jardin/i.test(hay)) {
        return 'exterior';
    }
    if (ti === 'dormitorio' || /dormitorio|habitaci[oó]n|suite|bedroom|pieza/i.test(hay)) return 'dormitorio';
    if (ti === 'bano' || /ba[ñn]o|bathroom/i.test(hay)) return 'bano';
    if (ti === 'cocina' || /cocina|kitchen/i.test(hay)) return 'cocina';
    if (ti === 'living' || /living|sala|estar|comedor/i.test(hay)) return 'living_comedor';
    if (/rio|lago|bosque|monta[nñ]a/i.test(hay)) return 'vista';
    return 'general';
}

function buildImagenesEtiquetadas(imagenes) {
    const list = Array.isArray(imagenes) ? imagenes : [];
    return list.map((img, idx) => ({
        url: img.url,
        thumbnail_url: img.thumbnail_url || null,
        tipo: _inferTipo({
            espacio: img.espacio,
            tipoIa: img.tipo_ia,
            alt: img.alt,
        }),
        alt: _normText(img.alt) || _normText(img.espacio) || `Imagen ${idx + 1}`,
        principal: !!img.principal,
        orden: Number.isFinite(Number(img.orden)) ? Number(img.orden) : idx + 1,
    }));
}

module.exports = {
    buildImagenesEtiquetadas,
};

