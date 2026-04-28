function registerSeoRoutes({ router, db, deps }) {
    const { obtenerPropiedadesPorEmpresa } = deps;
    const { generateAriFeed, generatePropertyListFeed } = require('../services/googleHotelsService');
    const { normalizeAriFeedRequest } = require('../services/ariFeedRequest');
    const { validateGoogleHotelsContentFeedAccess } = require('../services/googleHotelsContentFeedRequest');

    router.get('/robots.txt', (req, res) => {
        try {
            const baseUrl = req.baseUrl;
            if (!baseUrl) throw new Error('No se pudo determinar la URL base de la empresa.');
            const robotsTxtContent = `User-agent: *
Disallow: /api/
Disallow: /admin-assets/
Allow: /

# Indexación para asistentes y búsqueda con IA (mismo alcance que el sitio público)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Amazonbot
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
            res.setHeader('Content-Type', 'text/plain');
            res.send(robotsTxtContent);
        } catch (error) {
            console.error(`Error al generar robots.txt para ${req.empresa?.id}:`, error);
            res.status(500).send('Error al generar robots.txt');
        }
    });

    router.get('/sitemap.xml', async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            const baseUrl = req.baseUrl;
            if (!baseUrl) throw new Error('No se pudo determinar la URL base de la empresa.');
            const todasLasPropiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
            // Misma barra de calidad que el home SSR: listado + portada (evita URLs vacías para crawlers)
            const propiedadesListadas = todasLasPropiedades.filter(
                (p) => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath
            );
            const lastmodStatic = new Date().toISOString().slice(0, 10);
            let xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
            xmlString += `
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${lastmodStatic}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/contacto</loc>
        <lastmod>${lastmodStatic}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/guia-huesped</loc>
        <lastmod>${lastmodStatic}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>`;
            for (const prop of propiedadesListadas) {
                const lm = prop.updatedAt instanceof Date
                    ? prop.updatedAt.toISOString().slice(0, 10)
                    : (prop.updatedAt ? String(prop.updatedAt).slice(0, 10) : lastmodStatic);
                xmlString += `
    <url>
        <loc>${baseUrl}/propiedad/${prop.id}</loc>
        <lastmod>${lm}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
            }
            xmlString += `
</urlset>`;
            res.setHeader('Content-Type', 'application/xml');
            res.send(xmlString);
        } catch (error) {
            console.error(`Error al generar sitemap.xml para ${req.empresa?.id}:`, error);
            res.status(500).send('<error>Error al generar el sitemap.</error>');
        }
    });

    // Feed ARI público por tenant (host de la empresa actual).
    router.get('/feed-ari.xml', async (req, res) => {
        try {
            const empresaId = req.empresa?.id;
            if (!empresaId) return res.status(400).send('Empresa inválida.');

            const cfg = req.empresaCompleta?.websiteSettings?.integrations || {};
            const tokenCfg = String(cfg.ariFeedToken || '').trim();
            const parsed = normalizeAriFeedRequest(req.query, tokenCfg);
            if (!parsed.ok) return res.status(parsed.status || 400).send(parsed.error || 'Parámetros inválidos.');

            const xml = await generateAriFeed(db, empresaId, { mode: parsed.mode, days: parsed.days });
            res.type('application/xml').send(xml);
        } catch (error) {
            console.error(`Error al generar feed-ari.xml para ${req.empresa?.id}:`, error);
            res.status(500).send('<error>Error al generar feed ARI.</error>');
        }
    });

    // Ayuda para widget/feed (JSON público para UI y soporte).
    router.get('/widget-reserva-ayuda.json', (req, res) => {
        try {
            const baseUrl = req.baseUrl || '';
            const feed = baseUrl ? `${baseUrl}/feed-ari.xml` : '/feed-ari.xml';
            const contentFeed = baseUrl ? `${baseUrl}/feed-google-hotels-content.xml` : '/feed-google-hotels-content.xml';
            res.json({
                ok: true,
                ariFeed: {
                    endpoint: feed,
                    mode: ['website', 'google_hotels'],
                    days: { min: 14, max: 365, default: 180 },
                    token: 'Opcional: ?token=... si websiteSettings.integrations.ariFeedToken está configurado.',
                    examples: {
                        websiteDefault: feed,
                        website90: `${feed}?days=90`,
                        googleHotels180: `${feed}?mode=google_hotels&days=180`,
                    }
                },
                googleHotelsContentFeed: {
                    endpoint: contentFeed,
                    token: 'Opcional: ?token=... si websiteSettings.integrations.googleHotelsContentToken está configurado.',
                    notes: [
                        'Incluye propiedades listadas (isListed=true) con hotelId.',
                        'Formato XML básico de Property List para onboarding/validación de contenido.',
                    ],
                    examples: {
                        default: contentFeed,
                    }
                }
            });
        } catch (error) {
            console.error(`Error en widget-reserva-ayuda.json para ${req.empresa?.id}:`, error);
            res.status(500).json({ ok: false, error: 'No se pudo generar ayuda del widget/feed.' });
        }
    });

    // Feed contenido (Property List) público por tenant: `empresaId` desde middleware → propiedades filtradas por empresa en servicio.
    router.get('/feed-google-hotels-content.xml', async (req, res) => {
        try {
            const empresaId = req.empresa?.id;
            if (!empresaId) return res.status(400).send('Empresa inválida.');
            const cfg = req.empresaCompleta?.websiteSettings?.integrations || {};
            const tokenCfg = String(cfg.googleHotelsContentToken || '').trim();
            const access = validateGoogleHotelsContentFeedAccess(req.query, tokenCfg);
            if (!access.ok) return res.status(access.status || 401).send(access.error || 'Acceso denegado.');

            const xml = await generatePropertyListFeed(db, empresaId);
            res.type('application/xml').send(xml);
        } catch (error) {
            console.error(`Error al generar feed-google-hotels-content.xml para ${req.empresa?.id}:`, error);
            res.status(500).send('<error>Error al generar feed de contenido Google Hotels.</error>');
        }
    });
}

module.exports = { registerSeoRoutes };
