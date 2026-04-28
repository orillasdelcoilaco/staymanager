const { renderHomePage, renderContactoPage, renderGuestGuidePage } = require('./website.home.render');

function registerHomeRoutes({ router, db, cacheStaticRoutes, deps }) {
    router.get('/', cacheStaticRoutes, async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        await renderHomePage(req, res, db, deps);
    });

    router.get('/contacto', cacheStaticRoutes, async (req, res) => {
        await renderContactoPage(req, res);
    });

    router.get('/guia-huesped', cacheStaticRoutes, async (req, res) => {
        await renderGuestGuidePage(req, res);
    });
}

module.exports = { registerHomeRoutes };
