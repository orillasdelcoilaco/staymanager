// backend/services/marketplace.seo.js
// Genera robots.txt, sitemap.xml y llms.txt para el marketplace
const pool = require('../db/postgres');
const { PLATFORM_DOMAIN } = require('./marketplaceService');

const BASE_URL = `https://${PLATFORM_DOMAIN}`;

const generarSitemap = async () => {
    const { rows } = await pool.query(`
        SELECT p.id, p.updated_at, e.subdominio
        FROM propiedades p
        JOIN empresas e ON p.empresa_id = e.id
        WHERE p.activo = true
          AND e.subdominio IS NOT NULL
          AND e.subdominio != ''
        ORDER BY p.updated_at DESC
    `);

    const urls = [
        `<url><loc>${BASE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
        ...rows.map(p => {
            const loc = `https://${p.subdominio.toLowerCase()}.${PLATFORM_DOMAIN}/propiedad/${p.id}`;
            const lastmod = p.updated_at
                ? new Date(p.updated_at).toISOString().split('T')[0]
                : '';
            return [
                '<url>',
                `  <loc>${loc}</loc>`,
                lastmod ? `  <lastmod>${lastmod}</lastmod>` : '',
                '  <changefreq>weekly</changefreq>',
                '  <priority>0.8</priority>',
                '</url>',
            ].filter(Boolean).join('\n');
        }),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
};

const ROBOTS_TXT = `User-agent: *
Allow: /

# AI Crawlers — acceso completo al marketplace
User-agent: GPTBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GoogleExtendedCrawler
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;

const generarLlmsTxt = (propiedades = []) => {
    const ejemplos = propiedades.slice(0, 3)
        .map(p => `  - ${p.titulo} (${p.empresaNombre}, hasta ${p.capacidad} personas${p.precioDesde ? `, desde $${Number(p.precioDesde).toLocaleString('es-CL')}/noche` : ''})`)
        .join('\n');

    return `# SuiteManagers — Marketplace de Alojamientos en Chile
> Plataforma de reserva directa: huéspedes reservan con anfitriones sin pasar por OTAs.

## ¿Qué puedo hacer aquí?
- Buscar cabañas, casas y departamentos en Chile
- Ver disponibilidad real, precios, fotos y reseñas
- Reservar directamente con el anfitrión

## API para agentes de IA
Endpoint de búsqueda (JSON, sin autenticación):
\`\`\`
GET ${BASE_URL}/api/search.json
  ?q=TEXTO          — busca en nombre, descripción, empresa (ej: "pucon", "tinaja")
  &personas=N       — filtra por capacidad mínima
  &fecha_in=YYYY-MM-DD  — llegada (filtra disponibilidad real)
  &fecha_out=YYYY-MM-DD — salida
  &limit=N          — máximo resultados (default 40)
\`\`\`

Ejemplo: \`${BASE_URL}/api/search.json?q=pucon&personas=4\`

## Muestra de propiedades disponibles
${ejemplos || '  (Consulta /api/search.json para el listado actualizado)'}

## Recursos técnicos
- Marketplace: ${BASE_URL}/
- API JSON: ${BASE_URL}/api/search.json
- OpenAPI Spec: https://suite-manager.onrender.com/openapi.json
- Sitemap: ${BASE_URL}/sitemap.xml

## Notas para LLMs
- Los precios están en CLP (pesos chilenos)
- La disponibilidad se verifica en tiempo real contra bloqueos y reservas existentes
- Cada propiedad tiene URL propia: https://EMPRESA.${PLATFORM_DOMAIN}/propiedad/ID
`;
};

module.exports = { generarSitemap, ROBOTS_TXT, generarLlmsTxt };
