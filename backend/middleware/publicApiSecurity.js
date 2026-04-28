const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * NOTE IMPORTANTE (Render / proxy / IPv6):
 * express-rate-limit recomienda usar su helper ipKeyGenerator para evitar
 * bypass por formatos IPv6 (ej. /64 rotante).
 * Si no existe (versiones antiguas), hacemos fallback al string crudo.
 */
const ipKeyGenerator = typeof rateLimit.ipKeyGenerator === 'function'
    ? rateLimit.ipKeyGenerator
    : (ip) => String(ip || '');

/**
 * Normalización defensiva para construir keys estables de rate-limit.
 * - trim: evita diferencias por espacios
 * - lowercase: evita duplicados por mayúsculas/minúsculas
 */
function _norm(v) {
    return String(v || '').trim().toLowerCase();
}

/**
 * IPs de confianza separadas por coma.
 * Uso previsto: servidores controlados (QA interno, tareas automatizadas).
 * Ejemplo: TRUSTED_IPS=1.2.3.4,5.6.7.8
 */
function _trustedIps() {
    return (process.env.TRUSTED_IPS || '')
        .split(',')
        .map((v) => String(v || '').trim())
        .filter(Boolean);
}

function _isTrustedIp(req) {
    return _trustedIps().includes(req.ip);
}

/**
 * Tenant para segmentar límites por empresa.
 * Si no viene, usamos "sin-empresa" para no romper la key.
 */
function _empresaFromReq(req) {
    return _norm(
        req.body?.empresa_id
        || req.body?.empresaId
        || req.body?.empresa_id_raw
        || req.query?.empresa_id
        || req.query?.empresaId
    ) || 'sin-empresa';
}

/**
 * Email de huésped/cliente para endurecer creación de reserva.
 * Esto evita que una misma IP bloquee a todos los usuarios de una empresa,
 * pero sí corta ráfagas sobre el mismo huésped.
 */
function _emailFromReq(req) {
    return _norm(
        req.body?.huesped?.email
        || req.body?.cliente?.email
        || req.body?.email
    ) || 'sin-email';
}

/**
 * Key fuerte para POST /reservas:
 *   IP(normalizada) + empresa + email huésped
 * Objetivo: anti-abuso sin penalizar toda una empresa por un único actor.
 */
function bookingKeyByTenantIpEmail(req) {
    const ipKey = ipKeyGenerator(req.ip);
    const tenant = _empresaFromReq(req);
    const email = _emailFromReq(req);
    return `${ipKey}|${tenant}|${email}`;
}

// Config por env (sin romper defaults actuales).
const BOOKING_WORKFLOW_WINDOW_MS = Number(process.env.BOOKING_WORKFLOW_WINDOW_MS || 15 * 60 * 1000);
const BOOKING_WORKFLOW_MAX = Number(process.env.BOOKING_WORKFLOW_MAX || 20);
const CREATE_RESERVATION_WINDOW_MS = Number(process.env.CREATE_RESERVATION_WINDOW_MS || 15 * 60 * 1000);
const CREATE_RESERVATION_MAX = Number(process.env.CREATE_RESERVATION_MAX || 5);

/**
 * Rate limit "workflow":
 * - Aplica a resolve/cotizar/intent (pasos previos a reservar)
 * - Key: IP + empresa
 * - Umbral más alto porque son pasos exploratorios del agente
 */
const bookingWorkflowLimiter = rateLimit({
    windowMs: BOOKING_WORKFLOW_WINDOW_MS,
    max: BOOKING_WORKFLOW_MAX,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${_empresaFromReq(req)}`,
    message: {
        error: 'Demasiadas solicitudes en el flujo de reserva. Intente nuevamente en unos minutos.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => _isTrustedIp(req),
});

/**
 * Rate limit "crear reserva":
 * - Endpoint más sensible (efecto transaccional real)
 * - Key: IP + empresa + email huésped
 * - Umbral más bajo para frenar spam/abuso de creación
 */
const createReservationLimiter = rateLimit({
    windowMs: CREATE_RESERVATION_WINDOW_MS,
    max: CREATE_RESERVATION_MAX,
    keyGenerator: bookingKeyByTenantIpEmail,
    message: {
        error: 'Demasiadas reservas para este huésped. Intente nuevamente en unos minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => _isTrustedIp(req),
});

// Límite de lectura general (GET públicos).
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

// Ralentización progresiva (degrada suavemente antes de bloquear).
const speedLimiter = slowDown({
    windowMs: 1 * 60 * 1000, // 1 minuto
    delayAfter: 20,
    delayMs: () => 500 // Agregar 500ms de delay por cada request adicional (Fixed for v2)
});

// Filtro básico anti-bot (no reemplaza WAF/CDN).
const validateHumanLike = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';

    // Rechazar si no hay User-Agent o es muy corto
    if (!userAgent || userAgent.length < 10) {
        return res.status(403).json({
            error: 'Solicitud inválida',
            code: 'INVALID_REQUEST'
        });
    }

    // Lista de bots maliciosos conocidos (scrapers, no navegadores legítimos)
    const maliciousBots = ['scrapy', 'spider', 'crawler', 'scraper'];

    // Lista de agentes IA legítimos (para logging/analytics)
    const legitAIAgents = ['ChatGPT', 'Claude', 'GPT', 'Gemini', 'Anthropic', 'OpenAI'];

    const isMalicious = maliciousBots.some(bot =>
        userAgent.toLowerCase().includes(bot.toLowerCase())
    );

    const isLegitAI = legitAIAgents.some(ai =>
        userAgent.toLowerCase().includes(ai.toLowerCase())
    );

    // Solo bloquear bots maliciosos conocidos
    if (isMalicious) {
        console.warn(`[Security] Blocked malicious bot: ${userAgent}`);
        return res.status(403).json({
            error: 'Solicitud no autorizada',
            code: 'FORBIDDEN'
        });
    }

    // Log si es un agente IA legítimo (para analytics)
    if (isLegitAI) {
        console.log(`[Security] AI Agent detected: ${userAgent}`);
    }

    next();
};

// Sanitización mínima de body para evitar vectores triviales.
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
    bookingKeyByTenantIpEmail,
    bookingWorkflowLimiter,
    createReservationLimiter,
    readLimiter,
    speedLimiter,
    validateHumanLike,
    sanitizeInputs
};
