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
const {
    resolveMarketplaceLang,
    getMarketplaceStrings,
    buildMarketplaceQueryBase,
    buildMarketplaceSeoUrls,
} = require('../services/marketplaceUiStrings');
const { sendMarketplaceSearchJson } = require('./marketplaceSearchJson.handler');

const IS_PROD = !!process.env.RENDER;

const createMarketplaceRouter = (_db) => {
    const router = express.Router();

    // ── API JSON pública (para IA y terceros) ──────────────────────────────
    router.get('/api/search.json', cors(), sendMarketplaceSearchJson);

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
            const { q = '', personas = '', fecha_in = '', fecha_out = '', sort = '' } = req.query;
            const personasNum = parseInt(personas) || 0;
            const fechaIn = fecha_in.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_in : null;
            const fechaOut = fecha_out.match(/^\d{4}-\d{2}-\d{2}$/) ? fecha_out : null;
            const hayBusqueda = q.trim().length > 0 || personasNum > 0 || (fechaIn && fechaOut);

            const [propiedades, destacados] = await Promise.all([
                obtenerPropiedadesParaMarketplace({ busqueda: q.trim(), personas: personasNum, fechaIn, fechaOut, sort: sort || null }),
                hayBusqueda ? Promise.resolve([]) : obtenerDestacados(6),
            ]);

            const mpLang = resolveMarketplaceLang(req);
            const mp = getMarketplaceStrings(mpLang);
            const qBase = buildMarketplaceQueryBase({
                busqueda: q.trim(),
                personas: personasNum,
                fechaIn,
                fechaOut,
                sort: sort || null,
            });
            const pathEs = qBase.toString() ? `/?${qBase.toString()}` : '/';
            const qEn = new URLSearchParams(qBase);
            qEn.set('lang', 'en');
            const pathEn = qEn.toString() ? `/?${qEn.toString()}` : '/?lang=en';
            const seo = buildMarketplaceSeoUrls(req, {
                busqueda: q.trim(),
                personas: personasNum,
                fechaIn,
                fechaOut,
                sort: sort || null,
                htmlLang: mp.htmlLang,
            });
            const mpHomeUrl = mp.htmlLang === 'en' ? '/?lang=en' : '/';

            res.render('marketplace/index', {
                propiedades,
                destacados,
                busqueda: q.trim(),
                personas: personasNum,
                fechaIn: fechaIn || '',
                fechaOut: fechaOut || '',
                sort: sort || '',
                hayBusqueda,
                platformDomain: PLATFORM_DOMAIN,
                totalResultados: propiedades.length,
                mp,
                mpLinkEs: pathEs,
                mpLinkEn: pathEn,
                canonicalUrl: seo.canonicalUrl,
                hreflangEsUrl: seo.hreflangEsUrl,
                hreflangEnUrl: seo.hreflangEnUrl,
                mpHomeUrl,
            });
        } catch (err) {
            console.error('[Marketplace] Error en homepage:', err);
            res.status(500).send('Error cargando el marketplace');
        }
    });

    return router;
};

module.exports = { createMarketplaceRouter };
