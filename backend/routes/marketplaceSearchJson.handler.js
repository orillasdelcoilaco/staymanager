// Respuesta JSON pública del listado marketplace (host principal o suitemanagers.com).
const {
    obtenerPropiedadesParaMarketplace,
    PLATFORM_DOMAIN,
} = require('../services/marketplaceService');
const {
    resolveMarketplaceLang,
    getMarketplaceSearchJsonUi,
} = require('../services/marketplaceUiStrings');

async function sendMarketplaceSearchJson(req, res) {
    const mpLang = resolveMarketplaceLang(req);
    const ui = getMarketplaceSearchJsonUi(mpLang);
    try {
        const { q = '', personas = '', fecha_in = '', fecha_out = '', limit = '40', sort = '' } = req.query;
        const personasNum = parseInt(personas) || 0;
        const fechaIn = fecha_in.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_in : null;
        const fechaOut = fecha_out.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_out : null;
        const limitNum = Math.min(parseInt(limit) || 40, 100);

        const propiedades = await obtenerPropiedadesParaMarketplace({
            busqueda: q.trim(),
            personas: personasNum,
            fechaIn,
            fechaOut,
            limit: limitNum,
            sort: sort || null,
        });

        res.json({
            version: '1.1',
            locale: ui.locale,
            language: ui.language,
            ui,
            platform: PLATFORM_DOMAIN,
            query: {
                q: q.trim(),
                personas: personasNum,
                fechaIn,
                fechaOut,
                sort: sort || null,
                lang: mpLang,
            },
            total: propiedades.length,
            propiedades: propiedades.map((p) => ({
                id: p.id,
                titulo: p.titulo,
                empresa: p.empresaNombre,
                capacidad: p.capacidad,
                precioDesde: p.precioDesde,
                moneda: 'CLP',
                rating: p.rating,
                numResenas: p.numResenas,
                fotoUrl: p.fotoUrl,
                url: p.url,
            })),
        });
    } catch (err) {
        console.error('[Marketplace] Error en API search:', err);
        res.status(500).json({ error: ui.errorInternal, language: ui.language });
    }
}

module.exports = { sendMarketplaceSearchJson };
