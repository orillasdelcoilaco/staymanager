function _normText(v) {
    return String(v || '').trim();
}

function _inferTipo({ espacio, tipoIa, alt }) {
    const hay = `${_normText(espacio)} ${_normText(tipoIa)} ${_normText(alt)}`.toLowerCase();
    if (/dormitorio|habitaci[oó]n|bedroom/.test(hay)) return 'dormitorio';
    if (/ba[ñn]o|bathroom/.test(hay)) return 'bano';
    if (/cocina|kitchen/.test(hay)) return 'cocina';
    if (/comedor|living|sala|estar/.test(hay)) return 'living_comedor';
    if (/terraza|exterior|patio|quincho|parrilla/.test(hay)) return 'exterior';
    if (/vista|rio|lago|bosque|monta/.test(hay)) return 'vista';
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

