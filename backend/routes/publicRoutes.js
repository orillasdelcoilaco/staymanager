const express = require('express');
const router = express.Router();
const publicAiController = require('../controllers/publicAiController');
const {
    createReservationLimiter,
    readLimiter,
    speedLimiter,
    validateHumanLike,
    sanitizeInputs
} = require('../middleware/publicApiSecurity');

module.exports = (db) => {
    // Aplicar middlewares de seguridad a todas las rutas
    router.use(validateHumanLike);
    router.use(sanitizeInputs);

    // Middleware para attach db al request
    router.use(async (req, res, next) => {
        req.db = db;
        next();
    });

    // ===== ENDPOINTS DE CONSULTA (GET) =====

    // GET /api/public/version - Verificar versión desplegada
    router.get('/version', (req, res) => {
        res.json({
            version: '1.0.2-debug',
            timestamp: new Date().toISOString(),
            deployed_at: '2025-12-01T22:20:00Z'
        });
    });

    // GET /api/public/propiedades - Listar propiedades públicas
    router.get('/propiedades',
        readLimiter,
        speedLimiter,
        publicAiController.getProperties
    );

    // GET /api/public/propiedad/:id - Detalle de propiedad
    router.get('/propiedad/:id',
        readLimiter,
        publicAiController.getPropertyDetail
    );

    // GET /api/public/propiedad/:id/calendar - Calendario de disponibilidad
    router.get('/propiedad/:id/calendar',
        readLimiter,
        publicAiController.getPropertyCalendar
    );

    // GET /api/public/propiedades/:id/cotizar - Cotizar precio para fechas
    router.get('/propiedades/:id/cotizar',
        readLimiter,
        publicAiController.quotePriceForDates
    );

    // GET /api/public/propiedades/:id/disponibilidad - Verificar disponibilidad
    router.get('/propiedades/:id/disponibilidad',
        readLimiter,
        publicAiController.checkAvailability
    );

    // GET /api/public/propiedades/:id/imagenes - Obtener imágenes
    router.get('/propiedades/:id/imagenes',
        readLimiter,
        publicAiController.getPropertyImages
    );

    // ===== ENDPOINTS DE ACCIÓN (POST) =====

    // POST /api/public/reservar/intent - Crear intención de reserva (legacy)
    router.post('/reservar/intent',
        createReservationLimiter,
        publicAiController.createBookingIntent
    );

    // POST /api/public/reservas - Crear reserva pública (nuevo)
    router.post('/reservas',
        createReservationLimiter,
        publicAiController.createPublicReservation
    );

    // POST /api/public/webhooks/mercadopago - Webhook de MercadoPago
    router.post('/webhooks/mercadopago',
        publicAiController.webhookMercadoPago
    );

    // ===== ENDPOINTS DE DEBUG (solo desarrollo) =====

    if (process.env.NODE_ENV !== 'production') {
        router.get('/propiedades/debug', async (req, res) => {
            try {
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
    }

    return router;
};
