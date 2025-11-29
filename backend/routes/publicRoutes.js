const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const publicAiController = require('../controllers/publicAiController');
const { obtenerEmpresaPorDominio } = require('../services/empresaService');

// Rate Limiter Configuration
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: "Too many requests, please try again later.",
        retry_after_seconds: 15 * 60
    },
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json(options.message);
    }
});

module.exports = (db) => {
    // Apply Rate Limiter to all public routes
    router.use(apiLimiter);

    // Middleware to attach db to req and resolve tenant
    // Middleware to attach db to req and resolve tenant
    router.use(async (req, res, next) => {
        req.db = db;

        // Resolve Tenant
        try {
            const hostname = req.hostname;
            const empresa = await obtenerEmpresaPorDominio(db, hostname);

            if (empresa) {
                req.empresa = empresa;
                next();
            } else {
                console.warn(`[Public API] Tenant not found for hostname: ${hostname}`);
                res.status(404).json({ error: "Tenant not found" });
            }
        } catch (error) {
            console.error("[Public API] Error resolving tenant:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // GET /api/public/propiedades
    router.get('/propiedades', publicAiController.getProperties);

    // GET /api/public/propiedad/:id
    router.get('/propiedad/:id', publicAiController.getPropertyDetail);

    // GET /api/public/propiedad/:id/calendar
    router.get('/propiedad/:id/calendar', publicAiController.getPropertyCalendar);

    return router;
};
