// backend/middleware/tenantResolver.js

const { obtenerEmpresaPorDominio } = require('../services/empresaService');

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'suitemanagers.com';
const MARKETPLACE_HOSTS = new Set([
    PLATFORM_DOMAIN,
    `www.${PLATFORM_DOMAIN}`,
    'marketplace', // alias local: force_host=marketplace
]);

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
        res.setHeader('Set-Cookie', `force_host=${req.query.force_host}; Path=/; Max-Age=3600`);
    }

    const hostname = (forceHost || req.hostname).toLowerCase().trim();
    console.log(`[TenantResolver] Path: ${req.path}, Hostname: ${hostname}, ForceHost: ${forceHost}`);

    // Dominio raíz de la plataforma → marketplace (no buscar empresa)
    if (MARKETPLACE_HOSTS.has(hostname)) {
        console.log(`[TenantResolver] Marketplace detectado: ${hostname}`);
        req.isMarketplace = true;
        return next();
    }

    try {
        const empresa = await obtenerEmpresaPorDominio(db, hostname);

        if (empresa) {
            console.log(`[TenantResolver] Empresa encontrada: ${empresa.nombre} (${empresa.id})`);
            req.empresa = empresa;
        } else {
            console.log(`[TenantResolver] NO se encontró empresa para el hostname: ${hostname}`);
        }

        next();
    } catch (error) {
        console.error(`[TenantResolver] Error resolviendo el dominio ${hostname}:`, error);
        next();
    }
};

module.exports = { createTenantResolver };