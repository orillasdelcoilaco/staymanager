// backend/middleware/tenantResolver.js

const { obtenerEmpresaPorDominio } = require('../services/empresaService');

const createTenantResolver = (db) => async (req, res, next) => {
    // No aplicar este middleware a rutas de la API o del frontend estático
    if (req.path.startsWith('/api') || req.path.startsWith('/src') || req.path.startsWith('/public')) {
        return next();
    }
    
    const hostname = req.hostname;
    
    try {
        // Ignorar peticiones a localhost para no interferir con el desarrollo del admin
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
             return next();
        }

        const empresa = await obtenerEmpresaPorDominio(db, hostname);
        
        if (empresa) {
            req.empresa = empresa;
        }

        next();
    } catch (error) {
        console.error(`[TenantResolver] Error resolviendo el dominio ${hostname}:`, error);
        next(); // Continuar para que se maneje como una ruta normal (probablemente SPA o 404)
    }
};

module.exports = { createTenantResolver };