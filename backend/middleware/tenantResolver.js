// backend/middleware/tenantResolver.js

const { obtenerEmpresaPorDominio } = require('../services/empresaService');

const createTenantResolver = (db) => async (req, res, next) => {
    // Ignorar explícitamente cualquier ruta que pertenezca a la API o a los assets.
    if (req.path.startsWith('/api/') || req.path.startsWith('/src/') || req.path.startsWith('/public/')) {
        return next();
    }
    
    const hostname = req.hostname;
    
    try {
        const empresa = await obtenerEmpresaPorDominio(db, hostname);
        
        // Si se encuentra una empresa, se adjunta al objeto de la petición
        // para que las rutas SSR (y la ruta catch-all final) puedan usarla.
        if (empresa) {
            req.empresa = empresa;
        }

        // Continuamos siempre el flujo.
        next();
    } catch (error) {
        console.error(`[TenantResolver] Error resolviendo el dominio ${hostname}:`, error);
        next();
    }
};

module.exports = { createTenantResolver };