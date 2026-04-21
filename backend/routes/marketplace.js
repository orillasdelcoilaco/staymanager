// backend/routes/marketplace.js
// Rutas del marketplace público suitemanagers.com — completamente aisladas del SSR empresa
const express = require('express');
const cors = require('cors');
const {
    obtenerPropiedadesParaMarketplace,
    obtenerDestacados,
    PLATFORM_DOMAIN,
} = require('../services/marketplaceService');
const { generarLlmsTxt } = require('../services/marketplace.seo.js');

const IS_PROD = !!process.env.RENDER;

const createMarketplaceRouter = (_db) => {
    const router = express.Router();

    // ── API JSON pública (para IA y terceros) ──────────────────────────────
    router.get('/api/search.json', cors(), async (req, res) => {
        try {
            const { q = '', personas = '', fecha_in = '', fecha_out = '', limit = '40' } = req.query;
            const personasNum = parseInt(personas) || 0;
            const fechaIn = fecha_in.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_in : null;
            const fechaOut = fecha_out.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_out : null;
            const limitNum = Math.min(parseInt(limit) || 40, 100);

            const propiedades = await obtenerPropiedadesParaMarketplace({
                busqueda: q.trim(), personas: personasNum, fechaIn, fechaOut, limit: limitNum,
            });

            res.json({
                version: '1.0',
                platform: PLATFORM_DOMAIN,
                query: { q: q.trim(), personas: personasNum, fechaIn, fechaOut },
                total: propiedades.length,
                propiedades: propiedades.map(p => ({
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
            res.status(500).json({ error: 'Error interno' });
        }
    });

    // ── llms.txt dinámico ──────────────────────────────────────────────────
    router.get('/llms.txt', async (req, res) => {
        try {
            const propiedades = await obtenerPropiedadesParaMarketplace({ limit: 5 });
            res.type('text/plain').send(generarLlmsTxt(propiedades));
        } catch (err) {
            res.type('text/plain').send(generarLlmsTxt([]));
        }
    });

    // ── Redirect a propiedad (dev y prod) ──────────────────────────────────
    router.get('/ir', (req, res) => {
        const { s: subdominio, id } = req.query;
        if (!subdominio || !id) return res.redirect('/');
        const sub = subdominio.toLowerCase();
        if (IS_PROD) {
            return res.redirect(`https://${sub}.${PLATFORM_DOMAIN}/propiedad/${id}`);
        }
        const base = `${req.protocol}://${req.get('host')}`;
        res.redirect(`${base}/propiedad/${id}?force_host=${sub}.${PLATFORM_DOMAIN}`);
    });

    // ── Homepage ───────────────────────────────────────────────────────────
    router.get('/', async (req, res) => {
        try {
            const { q = '', personas = '', fecha_in = '', fecha_out = '' } = req.query;
            const personasNum = parseInt(personas) || 0;
            const fechaIn = fecha_in.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_in : null;
            const fechaOut = fecha_out.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_out : null;
            const hayBusqueda = q.trim().length > 0 || personasNum > 0 || (fechaIn && fechaOut);

            const [propiedades, destacados] = await Promise.all([
                obtenerPropiedadesParaMarketplace({ busqueda: q.trim(), personas: personasNum, fechaIn, fechaOut }),
                hayBusqueda ? Promise.resolve([]) : obtenerDestacados(6),
            ]);

            res.render('marketplace/index', {
                propiedades,
                destacados,
                busqueda: q.trim(),
                personas: personasNum,
                fechaIn: fechaIn || '',
                fechaOut: fechaOut || '',
                hayBusqueda,
                platformDomain: PLATFORM_DOMAIN,
                totalResultados: propiedades.length,
            });
        } catch (err) {
            console.error('[Marketplace] Error en homepage:', err);
            res.status(500).send('Error cargando el marketplace');
        }
    });

    return router;
};

module.exports = { createMarketplaceRouter };
