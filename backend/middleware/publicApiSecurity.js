const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiter para creación de reservas (3 por 15 minutos)
const createReservationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3,
    message: {
        error: 'Demasiadas solicitudes desde esta IP. Intente nuevamente en 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Permitir IPs confiables (ej. servidores de OpenAI, Anthropic)
        const trustedIPs = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
        return trustedIPs.includes(req.ip);
    }
});

// Rate limiter para consultas (30 por minuto)
const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30,
    message: {
        error: 'Demasiadas consultas. Intente nuevamente en un momento.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Slow down progresivo (ralentizar después de 20 requests/min)
const speedLimiter = slowDown({
    windowMs: 1 * 60 * 1000, // 1 minuto
    delayAfter: 20,
    delayMs: 500 // Agregar 500ms de delay por cada request adicional
});

// Validar que la solicitud parece venir de un agente legítimo
const validateHumanLike = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';

    // Rechazar si no hay User-Agent o es muy corto
    if (!userAgent || userAgent.length < 10) {
        return res.status(403).json({
            error: 'Solicitud inválida',
            code: 'INVALID_REQUEST'
        });
    }

    // Lista de bots sospechosos
    const suspiciousBots = ['curl', 'wget', 'python-requests', 'scrapy', 'bot', 'spider'];

    // Lista de agentes IA legítimos
    const legitAIAgents = ['ChatGPT', 'Claude', 'GPT', 'Gemini', 'Anthropic', 'OpenAI'];

    const isSuspicious = suspiciousBots.some(bot =>
        userAgent.toLowerCase().includes(bot.toLowerCase())
    );

    const isLegitAI = legitAIAgents.some(ai =>
        userAgent.toLowerCase().includes(ai.toLowerCase())
    );

    // Bloquear bots sospechosos que no son agentes IA legítimos
    if (isSuspicious && !isLegitAI) {
        console.warn(`[Security] Blocked suspicious User-Agent: ${userAgent}`);
        return res.status(403).json({
            error: 'Solicitud no autorizada',
            code: 'FORBIDDEN'
        });
    }

    next();
};

// Sanitizar inputs para prevenir inyección
const sanitizeInputs = (req, res, next) => {
    if (req.body) {
        // Eliminar propiedades peligrosas
        delete req.body.__proto__;
        delete req.body.constructor;
        delete req.body.prototype;

        // Limitar longitud de strings
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string' && req.body[key].length > 1000) {
                req.body[key] = req.body[key].substring(0, 1000);
            }
        });
    }

    next();
};

module.exports = {
    createReservationLimiter,
    readLimiter,
    speedLimiter,
    validateHumanLike,
    sanitizeInputs
};
