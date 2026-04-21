const { ssrCacheMiddleware } = require('../middleware/ssrCacheMiddleware');

function createWebsiteCacheMiddleware() {
    const ssrCacheOptions = {
        ttl: 30 * 60 * 1000,
        excludeParams: [
            '_',
            'nocache',
            'preview',
            'fechaLlegada',
            'fechaSalida',
            'personas',
            'check_in',
            'check_out',
            'photo_id',
        ],
        keyGenerator: (req) => {
            const empresaId = req.empresa?.id || 'unknown';
            const queryParams = { ...req.query };
            ['_', 'nocache', 'preview'].forEach((param) => delete queryParams[param]);
            const sortedParams = Object.keys(queryParams)
                .sort()
                .map((key) => `${key}=${queryParams[key]}`)
                .join('&');
            return `ssr:${empresaId}:${req.path}:${sortedParams}`;
        }
    };

    return ssrCacheMiddleware(ssrCacheOptions);
}

module.exports = { createWebsiteCacheMiddleware };
