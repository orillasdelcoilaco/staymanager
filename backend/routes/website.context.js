const { getEmpresaContextForSSR, getSSROptimizedData } = require('../services/buildContextService');
const { generateCustomCSS } = require('../services/brandIdentityService');
const { ssrCache } = require('../services/cacheService');

function createWebsiteContextMiddleware({ db, obtenerDetallesEmpresa }) {
    return async (req, res, next) => {
        if (!req.empresa || !req.empresa.id || typeof req.empresa.id !== 'string' || req.empresa.id.trim() === '') {
            console.error('[website.js middleware] Error: req.empresa.id inválido o no definido después del tenantResolver.');
            if (req.path === '/sitemap.xml' || req.path === '/robots.txt') {
                res.status(404).send('Archivo no encontrado: Empresa no válida.');
                return;
            }
            return next('router');
        }

        console.log(`[DEBUG website.js middleware] Empresa ID ${req.empresa.id} identificada.`);

        try {
            req.empresaCompleta = await obtenerDetallesEmpresa(db, req.empresa.id);

            if (req.empresaCompleta) {
                req.empresaCompleta.id = req.empresa.id;
                const protocol = req.protocol;
                const host = req.get('host');
                req.baseUrl = `${protocol}://${host}`;
                console.log(`[DEBUG middleware] Base URL determinada: ${req.baseUrl}`);
            } else {
                req.empresaCompleta = { id: req.empresa.id, nombre: req.empresa.nombre || 'Empresa (Detalles no cargados)' };
                req.baseUrl = '';
            }

            try {
                const ssrData = await ssrCache.withCache(
                    `empresa:ssr_optimized:${req.empresa.id}`,
                    () => getSSROptimizedData(req.empresa.id),
                    ssrCache.defaultTTLs.ssrOptimized
                );

                const { brand, seo, contacto, ubicacion, ...empresaContext } = ssrData;
                req.empresaContext = empresaContext;
                res.locals.empresaContext = empresaContext;

                const brandIdentity = {
                    colors: brand.paletaColores || {},
                    logos: brand.logos || {},
                    typography: brand.tipografia || {},
                    style: brand.estiloVisual || 'moderno',
                    tone: brand.tonoComunicacion || 'profesional',
                    valueProposition: brand.propuestaValor || ''
                };
                req.brandIdentity = brandIdentity;
                res.locals.brandIdentity = brandIdentity;

                if (brandIdentity && brandIdentity.colors) {
                    const customCSS = await ssrCache.withCache(
                        `empresa:css:${req.empresa.id}`,
                        () => generateCustomCSS(brandIdentity),
                        ssrCache.defaultTTLs.customCSS
                    );
                    res.locals.customCSS = customCSS;
                } else {
                    res.locals.customCSS = '';
                }

                res.locals.seo = seo;
                res.locals.contacto = contacto;
                res.locals.ubicacion = ubicacion;
            } catch (ssrError) {
                console.warn(`[DEBUG middleware] Error obteniendo datos SSR optimizados: ${ssrError.message}`);
                try {
                    const empresaContext = await getEmpresaContextForSSR(db, req.empresa.id);
                    req.empresaContext = empresaContext;
                    res.locals.empresaContext = empresaContext;
                } catch (fallbackError) {
                    console.warn(`[DEBUG middleware] Error en fallback: ${fallbackError.message}`);
                    req.empresaContext = null;
                    res.locals.empresaContext = null;
                }

                req.brandIdentity = null;
                res.locals.brandIdentity = null;
                res.locals.customCSS = '';
                res.locals.seo = {};
                res.locals.contacto = {};
                res.locals.ubicacion = {};
            }

            res.locals.empresa = req.empresaCompleta;
            next();
        } catch (error) {
            console.error(`Error cargando detalles completos para ${req.empresa.id}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: 'Error' }
            });
        }
    };
}

module.exports = { createWebsiteContextMiddleware };
