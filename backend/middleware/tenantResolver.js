// backend/middleware/tenantResolver.js

const { obtenerEmpresaPorDominio } = require('../services/empresaService');

const createTenantResolver = (db) => async (req, res, next) => {
    // Ignorar explícitamente cualquier ruta que pertenezca a la API o a los assets.
    if (req.path.startsWith('/api/') || req.path.startsWith('/src/') || req.path.startsWith('/public/')) {
        return next();
    }

    // Lógica para persistir force_host en cookie (para pruebas locales)
    let forceHost = req.query.force_host;

    // Si no viene en query, buscar en cookie
    if (!forceHost && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const parts = cookie.trim().split('=');
            if (parts.length === 2) {
                acc[parts[0].trim()] = parts[1].trim();
            }
            return acc;
        }, {});
        forceHost = cookies.force_host;
    }

    // Si viene en query, establecer cookie
    if (req.query.force_host) {
        console.log(`[TenantResolver] Setting cookie force_host=${req.query.force_host}`);
        // Establecer cookie simple, sin HttpOnly para facilitar debug si es necesario, pero Path=/ es clave
        res.setHeader('Set-Cookie', `force_host=${req.query.force_host}; Path=/`);
    }

    const hostname = forceHost || req.hostname;
    console.log(`[TenantResolver] Path: ${req.path}, Hostname: ${hostname}, Cookie: ${req.headers.cookie}, ForceHost: ${forceHost}`);

    try {
        const empresa = await obtenerEmpresaPorDominio(db, hostname);

        // Si se encuentra una empresa, se adjunta al objeto de la petición
        // para que las rutas SSR (y la ruta catch-all final) puedan usarla.
        if (empresa) {
            console.log(`[TenantResolver] Empresa encontrada: ${empresa.nombre} (${empresa.id})`);
            req.empresa = empresa;
        } else {
            console.log(`[TenantResolver] NO se encontró empresa para el hostname: ${hostname}`);
        }

        // Continuamos siempre el flujo.
        next();
    } catch (error) {
        console.error(`[TenantResolver] Error resolviendo el dominio ${hostname}:`, error);
        next();
    }
};

module.exports = { createTenantResolver };