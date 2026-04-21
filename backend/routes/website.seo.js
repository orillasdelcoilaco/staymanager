function registerSeoRoutes({ router, db, deps }) {
    const { obtenerPropiedadesPorEmpresa } = deps;

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
}

module.exports = { registerSeoRoutes };
