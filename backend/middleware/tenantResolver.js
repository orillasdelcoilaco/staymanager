// backend/middleware/tenantResolver.js

const { obtenerEmpresaPorDominio } = require('../services/empresaService');

const createTenantResolver = (db) => async (req, res, next) => {
    // SALVAGUARDA: Ignorar explícitamente cualquier ruta que pertenezca a la API o a los assets.
    // Esta es la comprobación más importante para evitar el error JSON.
    if (req.path.startsWith('/api/') || req.path.startsWith('/src/') || req.path.startsWith('/public/')) {
        return next();
    }
    
    const hostname = req.hostname;
    
    try {
        // Ignorar peticiones a localhost para no interferir con el desarrollo del admin
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
             return next();
        }

        const empresa = await obtenerEmpresaPorDominio(db, hostname);
        
        // Si se encuentra una empresa, se adjunta al objeto de la petición
        // para que las rutas SSR puedan usarla.
        if (empresa) {
            req.empresa = empresa;
        }

        // Continuamos el flujo. Si req.empresa no está definido, las rutas SSR se omitirán.
        next();
    } catch (error) {
        console.error(`[TenantResolver] Error resolviendo el dominio ${hostname}:`, error);
        next();
    }
};

module.exports = { createTenantResolver };