const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const publicAiController = require('../controllers/publicAiController');

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

    // Middleware to attach db to req
    router.use(async (req, res, next) => {
        req.db = db;
        next();
    });

    // [DEBUG] Endpoint de diagnóstico temporal
    router.get('/propiedades/debug', async (req, res) => {
        try {
            // Use the db instance passed to the router
            const allSnapshot = await db.collectionGroup('propiedades').get();
            const listedSnapshot = await db.collectionGroup('propiedades')
                .where('isListed', '==', true)
                .get();

            res.json({
                total_propiedades: allSnapshot.size,
                con_isListed_true: listedSnapshot.size,
                con_isListed_false: allSnapshot.size - listedSnapshot.size,
                muestra_primeras_3: allSnapshot.docs.slice(0, 3).map(d => ({
                    id: d.id,
                    nombre: d.data().nombre,
                    isListed: d.data().isListed,
                    empresaId: d.ref.parent.parent ? d.ref.parent.parent.id : 'unknown'
                }))
            });
        } catch (error) {
            res.status(500).json({
                error: error.message,
                code: error.code
            });
        }
    });

    // GET /api/public/propiedades
    router.get('/propiedades', publicAiController.getProperties);

    // GET /api/public/propiedad/:id
    router.get('/propiedad/:id', publicAiController.getPropertyDetail);

    // GET /api/public/propiedad/:id/calendar
    router.get('/propiedad/:id/calendar', publicAiController.getPropertyCalendar);

    // POST /api/public/reservar/intent
    router.post('/reservar/intent', publicAiController.createBookingIntent);

    return router;
};
