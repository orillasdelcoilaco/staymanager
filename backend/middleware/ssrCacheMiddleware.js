/**
 * backend/middleware/ssrCacheMiddleware.js
 *
 * Middleware de cache para rutas SSR.
 * Implementa cache de respuestas HTTP completas para páginas estáticas.
 */

const { ssrCache } = require('../services/cacheService');

/** Convierte chunk de res.write / res.end a string UTF-8 para almacenar HTML/texto. */
function chunkToUtf8String(chunk, encoding) {
    if (chunk == null || typeof chunk === 'function') return '';
    if (typeof chunk === 'string') return chunk;
    if (Buffer.isBuffer(chunk)) return chunk.toString(typeof encoding === 'string' ? encoding : 'utf8');
    if (typeof chunk === 'number' || typeof chunk === 'boolean') return String(chunk);
    return '';
}

/**
 * Middleware de cache para rutas SSR.
 * Cachea respuestas HTTP completas para páginas que no cambian frecuentemente.
 *
 * @param {Object} options - Opciones de configuración
 * @param {number} options.ttl - Tiempo de vida del cache en milisegundos (default: 1 hora)
 * @param {string[]} options.excludeParams - Parámetros de query que invalidan el cache
 * @param {Function} options.keyGenerator - Función para generar clave de cache personalizada
 * @returns {Function} Middleware de Express
 */
const ssrCacheMiddleware = (options = {}) => {
    const {
        ttl = 60 * 60 * 1000, // 1 hora por defecto
        excludeParams = ['_', 'nocache', 'preview'],
        keyGenerator = null
    } = options;

    return async (req, res, next) => {
        // Verificar si el cache está deshabilitado para esta ruta
        if (req.query.nocache || req.headers['x-nocache']) {
            res.setHeader('X-SSR-Cache', 'disabled');
            return next();
        }

        // Verificar si es una ruta que debe ser cacheada
        if (!shouldCacheRoute(req.path)) {
            return next();
        }

        // Generar clave de cache
        const cacheKey = keyGenerator
            ? keyGenerator(req)
            : generateCacheKey(req, excludeParams);

        try {
            // Intentar obtener del cache
            const cachedResponse = ssrCache.cache.get(cacheKey);

            if (cachedResponse) {
                // MemoryCache.get() ya valida TTL — si retornó algo, es válido
                res.setHeader('X-SSR-Cache', 'HIT');
                res.setHeader('X-SSR-Cache-Key', cacheKey);
                if (cachedResponse.expiresAt) {
                    res.setHeader('X-SSR-Cache-Expires', new Date(cachedResponse.expiresAt).toISOString());
                }

                // Restaurar headers originales
                if (cachedResponse.headers) {
                    Object.entries(cachedResponse.headers).forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });
                }

                return res.status(cachedResponse.status).send(cachedResponse.body);
            }

            // Si no hay cache o expiró, continuar y cachear la respuesta
            res.setHeader('X-SSR-Cache', 'MISS');

            const originalWrite = res.write;
            const originalEnd = res.end;
            const originalStatus = res.status;
            const originalSetHeader = res.setHeader;

            let responseBody = '';
            let responseStatus = 200;
            const responseHeaders = {};

            res.write = function (chunk, encoding, cb) {
                const enc = typeof encoding === 'function' ? undefined : encoding;
                responseBody += chunkToUtf8String(chunk, enc);
                return originalWrite.apply(this, arguments);
            };

            // Captura cuerpo: res.send/res.json terminan en end; también write+end o end directo
            res.end = function (chunk, encoding, cb) {
                if (typeof chunk === 'function') {
                    return originalEnd.apply(this, arguments);
                }
                const enc = typeof encoding === 'function' ? undefined : encoding;
                if (chunk != null) {
                    responseBody += chunkToUtf8String(chunk, enc);
                }
                return originalEnd.apply(this, arguments);
            };

            res.status = function (code) {
                responseStatus = code;
                return originalStatus.call(this, code);
            };

            // Interceptar setHeader para capturar headers
            res.setHeader = function (name, value) {
                responseHeaders[name] = value;
                return originalSetHeader.call(this, name, value);
            };

            // Interceptar el final de la respuesta para guardar en cache
            res.on('finish', () => {
                // Solo cachear respuestas exitosas
                if (responseStatus >= 200 && responseStatus < 300) {
                    const cacheEntry = {
                        body: responseBody,
                        status: responseStatus,
                        headers: responseHeaders,
                        expiresAt: Date.now() + ttl,
                        cachedAt: Date.now()
                    };

                    ssrCache.cache.set(cacheKey, cacheEntry, ttl);
                    console.log(`[SSR Cache] Respuesta cacheada para ${req.path} (key: ${cacheKey})`);
                }

                // Restaurar métodos originales
                res.write = originalWrite;
                res.end = originalEnd;
                res.status = originalStatus;
                res.setHeader = originalSetHeader;
            });

            next();

        } catch (error) {
            console.error(`[SSR Cache] Error en middleware de cache: ${error.message}`);
            // En caso de error, continuar sin cache
            res.setHeader('X-SSR-Cache', 'ERROR');
            next();
        }
    };
};

/**
 * Determina si una ruta debe ser cacheada.
 * @param {string} path - Ruta de la solicitud
 * @returns {boolean} True si la ruta debe ser cacheada
 */
function shouldCacheRoute(path) {
    // Rutas que NO deben ser cacheadas (prefijos). Alineado con website.* (reservas, APIs, etc.)
    const noCacheRoutes = [
        '/admin',
        '/login',
        '/logout',
        '/api/',
        '/webhook/',
        '/upload',
        '/checkout',
        '/booking',
        '/reservation',
        '/reservar',
        '/confirmacion',
        '/crear-reserva-publica',
        '/propiedad/',
        '/configuracion-web'
    ];

    // Rutas que SÍ pueden cachearse: solo las que montan `cacheStaticRoutes` en website.home.js
    const cacheableRoutes = ['/', '/contacto'];

    // Verificar rutas que NO deben ser cacheadas
    for (const route of noCacheRoutes) {
        if (path.startsWith(route)) {
            return false;
        }
    }

    // Verificar rutas que SÍ deben ser cacheadas
    for (const route of cacheableRoutes) {
        if (path === route || path.startsWith(`${route}/`)) {
            return true;
        }
    }

    // Por defecto, no cachear
    return false;
}

/**
 * Genera una clave de cache única para la solicitud.
 * @param {Object} req - Objeto de solicitud Express
 * @param {string[]} excludeParams - Parámetros de query a excluir
 * @returns {string} Clave de cache
 */
function generateCacheKey(req, excludeParams) {
    const { empresa } = req;
    const empresaId = empresa?.id || 'unknown';

    // Filtrar parámetros de query
    const queryParams = { ...req.query };
    excludeParams.forEach(param => delete queryParams[param]);

    // Ordenar parámetros para consistencia
    const sortedParams = Object.keys(queryParams)
        .sort()
        .map(key => `${key}=${queryParams[key]}`)
        .join('&');

    // Construir clave
    const parts = [
        'ssr',
        empresaId,
        req.method,
        req.path,
        sortedParams ? `?${sortedParams}` : ''
    ];

    return parts.join(':').replace(/[^a-zA-Z0-9:_\-]/g, '_');
}

/**
 * Invalida el cache para una empresa específica.
 * @param {string} empresaId - ID de la empresa
 */
function invalidateEmpresaSSRCache(empresaId) {
    const pattern = `ssr:${empresaId}:`;
    return ssrCache.invalidateByKey(pattern);
}

/**
 * Invalida el cache para una ruta específica.
 * @param {string} empresaId - ID de la empresa
 * @param {string} path - Ruta a invalidar
 */
function invalidateRouteCache(empresaId, path) {
    // Claves reales: `ssr:${empresaId}:${path}:${sortedQuery}` (ver website.cache.js keyGenerator)
    const fragment = `ssr:${empresaId}:${path}`;
    return ssrCache.invalidateByKey(fragment);
}

module.exports = {
    ssrCacheMiddleware,
    shouldCacheRoute,
    generateCacheKey,
    invalidateEmpresaSSRCache,
    invalidateRouteCache
};