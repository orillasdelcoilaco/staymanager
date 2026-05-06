const {
    listPublishedForSsr,
    getPublishedBySlug,
} = require('../services/blogPostService');

function registerBlogRoutes({ router, db, cacheStaticRoutes }) {
    router.get('/blog', cacheStaticRoutes, async (req, res, next) => {
        try {
            const empresaId = req.empresa.id;
            const posts = await listPublishedForSsr(db, empresaId);
            const baseUrl = req.baseUrl || '';
            const _hl = (res.locals.htmlLang || 'es') === 'en' ? 'en' : 'es';
            res.render('blog-index', {
                empresa: req.empresaCompleta,
                empresaContext: req.empresaContext,
                brandIdentity: req.brandIdentity,
                posts,
                baseUrl,
                htmlLang: _hl,
                title: _hl === 'en'
                    ? `Blog | ${req.empresaCompleta?.nombre || ''}`
                    : `Blog | ${req.empresaCompleta?.nombre || ''}`,
            });
        } catch (e) { next(e); }
    });

    router.get('/blog/:slug', cacheStaticRoutes, async (req, res, next) => {
        try {
            const empresaId = req.empresa.id;
            const slug = String(req.params.slug || '').trim();
            if (!slug) return res.redirect(`${req.baseUrl}/blog`);
            const post = await getPublishedBySlug(db, empresaId, slug);
            if (!post) return next();
            const baseUrl = req.baseUrl || '';
            const _hl = (res.locals.htmlLang || 'es') === 'en' ? 'en' : 'es';
            const pageTitle = post.title || 'Blog';
            const metaDescription = post.metaDescription || post.excerpt || '';
            res.render('blog-post', {
                empresa: req.empresaCompleta,
                empresaContext: req.empresaContext,
                brandIdentity: req.brandIdentity,
                post,
                baseUrl,
                htmlLang: _hl,
                title: `${pageTitle} | ${req.empresaCompleta?.nombre || ''}`,
                metaDescription,
            });
        } catch (e) { next(e); }
    });
}

module.exports = { registerBlogRoutes };
