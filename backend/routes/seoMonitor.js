const express = require('express');
const pool = require('../db/postgres');
const { obtenerDetallesEmpresa } = require('../services/empresaService');
const { obtenerPropiedadesPorEmpresa } = require('../services/propiedadesService');
const { PLATFORM_DOMAIN } = require('../services/marketplaceService');
const { probeRobotsAndSitemap } = require('../services/seoMonitorProbeService');

/** Entrada a Search Console sin `resource_id` (evita /not-verified si la propiedad no existe aún). */
const SEARCH_CONSOLE_ENTRY_URL = 'https://search.google.com/search-console';

function normalizePublicHost(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    let h = raw.trim().toLowerCase();
    h = h.replace(/^https?:\/\//, '');
    const slash = h.indexOf('/');
    if (slash !== -1) h = h.slice(0, slash);
    const colon = h.indexOf(':');
    if (colon !== -1) h = h.slice(0, colon);
    return h;
}

/**
 * Host para sondas SEO y enlaces del monitor.
 * 1) websiteSettings.general.seoProbeHost (override manual)
 * 2) subdominio SuiteManagers → {sub}.{PLATFORM_DOMAIN} (URL típica del producto)
 * 3) domain / empresa.dominio (dominio propio sin sub en datos)
 */
function getTenantHost(empresa) {
    const cfg = empresa?.websiteSettings?.general || {};
    const probeOverride = normalizePublicHost(cfg.seoProbeHost);
    if (probeOverride) return probeOverride;

    const sub = String(cfg.subdomain || empresa?.subdominio || '').trim().toLowerCase();
    if (sub) return `${sub}.${PLATFORM_DOMAIN}`;

    const fromGeneral = normalizePublicHost(cfg.domain);
    if (fromGeneral) return fromGeneral;

    return normalizePublicHost(empresa?.dominio);
}

function getAlternatePublicHost(empresa, primaryHost) {
    const cfg = empresa?.websiteSettings?.general || {};
    const customOrLegacy = normalizePublicHost(cfg.domain) || normalizePublicHost(empresa?.dominio);
    if (!customOrLegacy || !primaryHost || customOrLegacy === primaryHost) return '';
    return customOrLegacy;
}

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}

function isSuperAdminRole(role) {
    const r = normalizeRole(role);
    return r === 'superadmin' || r === 'super_admin' || r === 'platform_admin';
}

function buildSearchLinks(hostname) {
    const base = {
        searchConsole: SEARCH_CONSOLE_ENTRY_URL,
        bingWebmaster: 'https://www.bing.com/webmasters',
        searchConsolePropertyPrefix: '',
    };
    if (!hostname) {
        base.searchConsole = '';
        return base;
    }
    return {
        ...base,
        searchConsolePropertyPrefix: `https://${hostname}/`,
    };
}

function toCheck(id, label, ok, detail, hint = '') {
    return {
        id,
        label,
        status: ok ? 'ok' : 'warn',
        detail,
        hint,
    };
}

function dedupeActions(actions) {
    const seen = new Set();
    return actions.filter((a) => {
        if (!a || !a.id || seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
    });
}

function buildTenantPanelActions({ host, propiedades, listed, withCardImage }) {
    const actions = [];
    if (!host) {
        actions.push({
            id: 'fix-host-publico',
            label: 'Configurar dominio o subdominio público del sitio',
            path: '/website-general',
        });
    }
    if (propiedades.length > 0 && listed.length === 0) {
        actions.push({
            id: 'fix-propiedades-listadas',
            label: 'Marcar alojamientos como listados para indexación (sitemap)',
            path: '/canales-ia',
        });
    }
    if (propiedades.length > 0 && withCardImage.length < propiedades.length) {
        actions.push({
            id: 'fix-portada-seo',
            label: 'Completar imagen portada / card en Contenido Web por alojamiento',
            path: '/website-alojamientos',
        });
    }
    return dedupeActions(actions);
}

function buildPlatformPanelActions({ total, listed }) {
    const actions = [];
    if (total > 0 && listed === 0) {
        actions.push({
            id: 'fix-listado-tenants',
            label: 'Revisar listado por empresa: Canales IA → publicar en Web/Google',
            path: '/canales-ia',
        });
    }
    return dedupeActions(actions);
}

function httpEndpointsReachable(http) {
    if (!http || http.skipped) return true;
    const r = http.robots;
    const s = http.sitemap;
    const rob = r && r.ok && r.status === 200;
    const site = s && s.ok && s.status === 200;
    return rob && site;
}

function appendHttpChecks(checks, http) {
    if (!http || http.skipped) return;
    const { robots, sitemap } = http;
    const robOk = robots && robots.ok && robots.status === 200;
    const siteOk = sitemap && sitemap.ok && sitemap.status === 200;
    checks.push(toCheck(
        'robots_http',
        'robots.txt alcanzable (HTTP)',
        robOk,
        robOk
            ? `HTTP ${robots.status} · ${robots.durationMs} ms · ~${robots.sampledBytes} B leídos`
            : `No OK: ${robots?.error || `HTTP ${robots?.status ?? '—'}`}`,
        'Verifica DNS, SSL y que el sitio público responda en ese host.'
    ));
    checks.push(toCheck(
        'sitemap_http',
        'sitemap.xml alcanzable (HTTP)',
        siteOk,
        siteOk
            ? `HTTP ${sitemap.status} · ${sitemap.durationMs} ms · ~${sitemap.sampledBytes} B leídos`
            : `No OK: ${sitemap?.error || `HTTP ${sitemap?.status ?? '—'}`}`,
        'Si los datos del panel están bien pero falla el sitemap, revisa despliegue y rutas SSR.'
    ));
}

function enrichPanelActionsForHttp(panelActions, http, opts = {}) {
    const { addTenantWebsiteFix = true } = opts;
    if (!http || http.skipped) return panelActions;
    if (httpEndpointsReachable(http)) return panelActions;
    if (!addTenantWebsiteFix) return panelActions;
    return dedupeActions([
        ...panelActions,
        {
            id: 'fix-http-publico',
            label: 'Revisar dominio, DNS y que el sitio público responda (Configuración Web)',
            path: '/website-general',
        },
    ]);
}

module.exports = (db) => {
    const router = express.Router();

    router.get('/tenant', async (req, res) => {
        try {
            const empresaId = req.user?.empresaId;
            if (!empresaId) {
                return res.status(400).json({ error: 'empresaId no disponible en sesión.' });
            }

            const [empresa, propiedades] = await Promise.all([
                obtenerDetallesEmpresa(db, empresaId),
                obtenerPropiedadesPorEmpresa(db, empresaId),
            ]);

            const host = getTenantHost(empresa);
            const alternatePublicHost = getAlternatePublicHost(empresa, host);
            const baseUrl = host ? `https://${host}` : '';
            const listed = propiedades.filter((p) => p.googleHotelData?.isListed === true);
            const withCardImage = propiedades.filter((p) => p.websiteData?.cardImage?.storagePath);

            const checks = [
                toCheck(
                    'host_publico',
                    'Host público configurado',
                    Boolean(host),
                    host || 'No hay dominio/subdominio público configurado.',
                    'Configura dominio o subdominio en Sitio público -> Configuración Web.'
                ),
                toCheck(
                    'propiedades_listadas',
                    'Propiedades listadas para indexación',
                    listed.length > 0,
                    `${listed.length} de ${propiedades.length} propiedades marcadas como listadas.`,
                    'Sin propiedades listadas, sitemap y páginas indexables quedan casi vacías.'
                ),
                toCheck(
                    'imagenes_portada',
                    'Portadas listas para SEO',
                    withCardImage.length > 0,
                    `${withCardImage.length} de ${propiedades.length} propiedades con imagen card/portada.`,
                    'Sin portada hay riesgo de snippets pobres en buscadores.'
                ),
                toCheck(
                    'sitemap_estimado',
                    'Cobertura estimada de sitemap',
                    listed.length === 0 || withCardImage.length > 0,
                    `URLs base esperadas: 3 estáticas + ${listed.length} fichas de propiedad listadas.`,
                    'El sitemap tenant incluye home/contacto/guía + fichas listadas con portada.'
                ),
            ];

            const httpChecks = baseUrl
                ? await probeRobotsAndSitemap(baseUrl)
                : { skipped: true, reason: 'Sin host público' };
            appendHttpChecks(checks, httpChecks);

            const recommendations = checks
                .filter((c) => c.status !== 'ok')
                .map((c) => ({
                    id: c.id,
                    action: c.hint || c.detail,
                }));

            let panelActions = buildTenantPanelActions({
                host,
                propiedades,
                listed,
                withCardImage,
            });
            panelActions = enrichPanelActionsForHttp(panelActions, httpChecks);

            res.json({
                scope: 'tenant',
                empresa: {
                    id: empresa.id,
                    nombre: empresa.nombre,
                    host,
                    baseUrl,
                    alternatePublicHost,
                },
                links: {
                    home: baseUrl ? `${baseUrl}/` : '',
                    sitemap: baseUrl ? `${baseUrl}/sitemap.xml` : '',
                    robots: baseUrl ? `${baseUrl}/robots.txt` : '',
                    ...buildSearchLinks(host),
                },
                metrics: {
                    totalProperties: propiedades.length,
                    listedProperties: listed.length,
                    propertiesWithCardImage: withCardImage.length,
                },
                checks,
                recommendations,
                panelActions,
                httpChecks,
            });
        } catch (error) {
            console.error('[seoMonitor][tenant]:', error);
            res.status(500).json({ error: 'No se pudo calcular el diagnóstico SEO del tenant.' });
        }
    });

    router.get('/platform', async (req, res) => {
        try {
            if (!isSuperAdminRole(req.user?.rol)) {
                return res.status(403).json({
                    error: 'Este módulo es exclusivo para superadministrador.',
                });
            }

            if (!pool) {
                return res.status(503).json({
                    error: 'PostgreSQL no está activo para diagnóstico de plataforma.',
                });
            }

            const [totalsResult, listedResult] = await Promise.all([
                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM propiedades p
                    JOIN empresas e ON e.id = p.empresa_id
                    WHERE p.activo = true
                      AND COALESCE(e.subdominio, '') <> ''
                `),
                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM propiedades p
                    JOIN empresas e ON e.id = p.empresa_id
                    WHERE p.activo = true
                      AND COALESCE(e.subdominio, '') <> ''
                      AND COALESCE((p.metadata->'googleHotelData'->>'isListed')::boolean, false) = true
                `),
            ]);

            const total = totalsResult.rows[0]?.total || 0;
            const listed = listedResult.rows[0]?.total || 0;
            const baseUrl = `https://${PLATFORM_DOMAIN}`;

            const checks = [
                toCheck(
                    'marketplace_inventory',
                    'Inventario activo en marketplace',
                    total > 0,
                    `${total} propiedades activas con subdominio válido.`
                ),
                toCheck(
                    'marketplace_listed',
                    'Cobertura listada para Google/SEO',
                    listed > 0,
                    `${listed} propiedades con flag isListed=true.`,
                    'Revisar opt-in listado para mejorar cobertura en buscadores.'
                ),
            ];

            const httpChecks = await probeRobotsAndSitemap(baseUrl);
            appendHttpChecks(checks, httpChecks);

            let panelActions = buildPlatformPanelActions({ total, listed });
            panelActions = enrichPanelActionsForHttp(panelActions, httpChecks, {
                addTenantWebsiteFix: false,
            });

            const recommendations = checks
                .filter((c) => c.status !== 'ok')
                .map((c) => ({
                    id: c.id,
                    action: c.hint || c.detail,
                }));

            res.json({
                scope: 'platform',
                platform: {
                    domain: PLATFORM_DOMAIN,
                    baseUrl,
                },
                links: {
                    home: `${baseUrl}/`,
                    sitemap: `${baseUrl}/sitemap.xml`,
                    robots: `${baseUrl}/robots.txt`,
                    marketplaceGoogleHotels: `${baseUrl}/google-hotels`,
                    searchConsole: SEARCH_CONSOLE_ENTRY_URL,
                    searchConsolePropertyPrefix: `${baseUrl}/`,
                    bingWebmaster: 'https://www.bing.com/webmasters',
                },
                metrics: {
                    marketplaceActiveProperties: total,
                    marketplaceListedProperties: listed,
                },
                checks,
                recommendations,
                panelActions,
                httpChecks,
            });
        } catch (error) {
            console.error('[seoMonitor][platform]:', error);
            res.status(500).json({ error: 'No se pudo calcular el diagnóstico SEO de plataforma.' });
        }
    });

    return router;
};
