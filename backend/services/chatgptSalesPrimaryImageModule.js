function _norm(v) {
    return String(v || '').trim();
}

function _haystack(img) {
    return `${_norm(img.alt)} ${_norm(img.espacio)} ${_norm(img.tipo)}`.toLowerCase();
}

/**
 * Puntuación para elegir portada “vendedora”. Penaliza estacionamiento / parking.
 * @param {{ tipo?: string, alt?: string, espacio?: string }} img
 */
function scoreImagenVentas(img) {
    const h = _haystack(img);
    if (/estacionamiento|parking|estaciona|cochera|garage|veh[ií]culo|carport/i.test(h)) return -120;
    if (img.tipo === 'tinaja' || /tinaja|jacuzzi|hidromasaje|hot\s*tub/i.test(h)) return 100;
    if (img.tipo === 'piscina' || /piscina|pileta|pool|alberca/i.test(h)) return 95;
    if (img.tipo === 'vista' || /vista|mirador|panor[aá]mica|panoramic/i.test(h)) return 88;
    if (img.tipo === 'exterior' || /terraza|quincho|parrilla|asador|bbq|jard[ií]n|jardin|patio|deck/i.test(h)) {
        return 75;
    }
    if (img.tipo === 'dormitorio' || /dormitor|suite|habitaci[oó]n|bedroom/i.test(h)) return 68;
    if (img.tipo === 'cocina' || /cocina|kitchen/i.test(h)) return 55;
    if (img.tipo === 'living_comedor' || /living|estar|sala/i.test(h)) return 52;
    if (img.tipo === 'bano' || /ba[ñn]o|bathroom/i.test(h)) return 38;
    if (img.tipo === 'general') return 22;
    return 30;
}

function _altComercialPrincipal(img, nombrePropiedad) {
    const nombre = _norm(nombrePropiedad) || 'Alojamiento';
    const tipo = String(img.tipo || 'general');
    const h = _haystack(img);
    if (/tinaja|jacuzzi|hidromasaje|hot\s*tub/i.test(h) || tipo === 'tinaja') {
        return `${nombre} — tinaja al aire libre para descansar`;
    }
    if (/piscina|pileta|pool/i.test(h) || tipo === 'piscina') {
        return `${nombre} — piscina o pileta para disfrutar en temporada`;
    }
    if (tipo === 'vista' || /vista|mirador|panor/i.test(h)) {
        return `${nombre} — vistas y entorno destacado`;
    }
    if (tipo === 'exterior' || /terraza|quincho|parrilla|jard[ií]n|patio/i.test(h)) {
        return `${nombre} — terraza o espacio exterior para compartir`;
    }
    if (tipo === 'dormitorio' || /dormitor|suite|habitaci/i.test(h)) {
        return `${nombre} — dormitorio amplio y acogedor`;
    }
    if (tipo === 'cocina' || /cocina/i.test(h)) {
        return `${nombre} — cocina equipada`;
    }
    if (tipo === 'living_comedor' || /living|sala|estar/i.test(h)) {
        return `${nombre} — living cómodo y luminoso`;
    }
    if (/estacionamiento|parking|cochera|garage/i.test(h)) {
        return `${nombre} — acceso y estacionamiento`;
    }
    const base = _norm(img.alt) || _norm(img.espacio) || 'Imagen destacada';
    return `${nombre} — ${base}`;
}

/**
 * Elige foto principal para ventas IA: si la marcada en catálogo es “débil” (parking, etc.),
 * sustituye por la imagen con mayor score.
 * @param {Array<object>} imagenesEtiquetadas — salida de buildImagenesEtiquetadas
 * @param {{ nombrePropiedad?: string }} opts
 */
function buildFotoPrincipalVentas(imagenesEtiquetadas, opts = {}) {
    const list = Array.isArray(imagenesEtiquetadas) ? imagenesEtiquetadas : [];
    if (!list.length) return null;

    const nombrePropiedad = opts.nombrePropiedad || '';
    const scored = list.map((img, idx) => ({
        idx,
        img,
        score: scoreImagenVentas(img),
    }));
    const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
    const marked = scored.find((s) => s.img.principal);

    const minScorePrincipal = 35;
    const useMarked =
        marked &&
        marked.score >= minScorePrincipal &&
        marked.score >= best.score - 5;

    const pick = useMarked ? marked.img : best.img;
    const origen = useMarked && marked.score >= minScorePrincipal ? 'catalogo' : 'auto_ranking_ventas';

    const altOriginal = _norm(pick.alt) || _norm(pick.espacio) || null;
    const altComercial = _altComercialPrincipal(pick, nombrePropiedad);

    return {
        ...pick,
        alt_original: altOriginal,
        alt: altComercial,
        foto_principal_origen: origen,
        foto_principal_score: useMarked ? marked.score : best.score,
    };
}

module.exports = {
    buildFotoPrincipalVentas,
    scoreImagenVentas,
};
