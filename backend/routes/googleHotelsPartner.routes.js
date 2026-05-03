/**
 * Connectivity Partner — feeds globales (TASKS/venta-ia.md §7).
 * Montar en app **antes** del tenantResolver; rutas bajo `/feeds/google`.
 */
const express = require('express');
const {
    generateGlobalPropertyListXml,
    generateGlobalAriXml,
} = require('../services/googleHotelsPartner/googleHotelsPartnerFeeds');

function isPartnerFeedHostAllowed(req) {
    const platform = (process.env.PLATFORM_DOMAIN || 'suitemanagers.com').toLowerCase();
    const host = (req.hostname || '').toLowerCase();
    const allowed = new Set([
        `api.${platform}`,
        `feeds.${platform}`,
        'localhost',
        '127.0.0.1',
        // Hostnames fijos acordados (venta-ia §1.2): feeds DNS en suitemanagers.com con tenants en suite-manager.com
        'feeds.suitemanagers.com',
        'api.suitemanagers.com',
        'feeds.suite-manager.com',
        'api.suite-manager.com',
    ]);
    String(process.env.GOOGLE_PARTNER_EXTRA_HOSTS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((h) => allowed.add(h));
    return allowed.has(host);
}

function partnerFeedHostMiddleware(req, res, next) {
    if (!isPartnerFeedHostAllowed(req)) {
        return res.status(403).type('text/plain')
            .send('Forbidden: Google partner feeds must be requested on api.<PLATFORM_DOMAIN>, feeds.<PLATFORM_DOMAIN>, or localhost.');
    }
    next();
}

function partnerFeedAuthMiddleware(req, res, next) {
    const expected = String(process.env.GOOGLE_PARTNER_FEED_AUTH_TOKEN || '').trim();
    const provided = String(req.query.auth || '').trim();
    const devOpen =
        process.env.NODE_ENV !== 'production'
        && process.env.ALLOW_PARTNER_FEED_WITHOUT_AUTH === '1';

    if (devOpen) {
        return next();
    }
    if (!expected || expected.length < 16) {
        console.error('[PartnerFeed] Misconfigured: set GOOGLE_PARTNER_FEED_AUTH_TOKEN (long secret).');
        return res.status(503).type('text/plain').send('Partner feeds not configured');
    }
    if (provided !== expected) {
        return res.status(401).type('text/plain').send('Unauthorized');
    }
    next();
}

/**
 * Router montado en la app como `app.use('/feeds/google', createPartnerFeedsSubrouter(db))`
 * (rutas finales: `/feeds/google/properties.xml`, `/feeds/google/ari.xml`).
 * Montaje explícito evita que el catch-all del SPA sirva `index.html` y el cliente redirija a `/login`.
 */
function createPartnerFeedsSubrouter(db) {
    const feeds = express.Router();

    feeds.use(partnerFeedHostMiddleware);
    feeds.use(partnerFeedAuthMiddleware);

    feeds.get('/properties.xml', async (_req, res) => {
        try {
            const { xml, skipped } = await generateGlobalPropertyListXml(db);
            if (skipped.length) {
                console.warn('[PartnerFeed] Property list skipped rows:', skipped.length, skipped.slice(0, 20));
            }
            res.type('application/xml').send(xml);
        } catch (e) {
            console.error('[PartnerFeed] properties.xml', e);
            if (e.message === 'POSTGRES_REQUIRED') {
                return res.status(503).type('text/plain').send('PostgreSQL required');
            }
            const detail = (e && e.message) ? String(e.message) : 'Error generating feed';
            res.status(500).type('text/plain').send(detail.slice(0, 8000));
        }
    });

    feeds.get('/ari.xml', async (_req, res) => {
        try {
            const { xml, skipped, propertySkipLog } = await generateGlobalAriXml(db);
            if (skipped.length) {
                console.warn('[PartnerFeed] ARI skipped empresas:', skipped.length, skipped.slice(0, 15));
            }
            if (propertySkipLog && propertySkipLog.length) {
                console.warn('[PartnerFeed] ARI property exclusions:', propertySkipLog.length, propertySkipLog.slice(0, 20));
            }
            res.type('application/xml').send(xml);
        } catch (e) {
            console.error('[PartnerFeed] ari.xml', e);
            if (e.message === 'POSTGRES_REQUIRED') {
                return res.status(503).type('text/plain').send('PostgreSQL required');
            }
            const detail = (e && e.message) ? String(e.message) : 'Error generating feed';
            res.status(500).type('text/plain').send(detail.slice(0, 8000));
        }
    });

    feeds.use((_req, res) => {
        res.status(404).type('text/plain').send('Not found');
    });

    return feeds;
}

/** @deprecated Prefer `app.use('/feeds/google', createPartnerFeedsSubrouter(db))` en index.js */
function createGoogleHotelsPartnerRouter(db) {
    const router = express.Router();
    router.use('/feeds/google', createPartnerFeedsSubrouter(db));
    return router;
}

module.exports = { createGoogleHotelsPartnerRouter, createPartnerFeedsSubrouter };
