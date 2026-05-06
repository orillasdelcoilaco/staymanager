/**
 * Limita frecuencia de llamadas a endpoints del panel que disparan IA (por empresa).
 * Mitiga abuso y reduce coste cuando varios usuarios comparten cuenta.
 *
 * Env:
 * - AI_PANEL_WINDOW_MS (default 900000 = 15 min)
 * - AI_PANEL_HEAVY_MAX (default 14) — narrativa, JSON-LD, plan fotos, perfil, reclasificar…
 * - AI_PANEL_LIGHT_MAX (default 45) — metadatos por subida de imagen / audit-slot
 *
 * Nota: memoria por proceso; con varios dynos cada uno tiene su contador (mejor que nada;
 * para multi-instancia estricto usar Redis en el futuro).
 */

const WINDOW_MS = Math.max(60_000, Number(process.env.AI_PANEL_WINDOW_MS || 900000));
const HEAVY_MAX = Math.max(1, Number(process.env.AI_PANEL_HEAVY_MAX || 14));
const LIGHT_MAX = Math.max(1, Number(process.env.AI_PANEL_LIGHT_MAX || 45));

/** Rutas que disparan muchos tokens / varios modelos seguidos */
const HEAVY_PATH_RE =
    /\/(generar-plan-fotos|generate-ai-text|generate-narrativa|generate-jsonld|optimize-profile|reclasificar-activos|generate-description|blog\/internal\/generate-draft)(\/|$)/;

/** Subidas / auditoría con IA por archivo (más permisivo) */
const LIGHT_PATH_RE = /\/(audit-slot|upload-image|upload-card-image|upload-hero-image)(\/|$)/;

/** Memoria: empresaId -> { start, heavy, light } */
const store = new Map();

function classifyRoute(path) {
    const p = path || '';
    if (HEAVY_PATH_RE.test(p)) return 'heavy';
    if (LIGHT_PATH_RE.test(p)) return 'light';
    return null;
}

function pruneStale(now) {
    if (store.size < 5000) return;
    const cutoff = now - WINDOW_MS * 3;
    for (const [k, v] of store.entries()) {
        if (v.start < cutoff) store.delete(k);
    }
}

/**
 * Middleware Express: aplicar solo al router /website (ya montado).
 */
function aiPanelGenerationLimiter(req, res, next) {
    if (req.method !== 'POST') return next();

    const kind = classifyRoute(req.path || req.url || '');
    if (!kind) return next();

    const empresaId = req.user?.empresaId;
    if (!empresaId) return next();

    const now = Date.now();
    pruneStale(now);

    let row = store.get(empresaId);
    if (!row || now - row.start > WINDOW_MS) {
        row = { start: now, heavy: 0, light: 0 };
        store.set(empresaId, row);
    }

    if (kind === 'heavy') {
        row.heavy += 1;
        if (row.heavy > HEAVY_MAX) {
            const retrySec = Math.max(1, Math.ceil((WINDOW_MS - (now - row.start)) / 1000));
            res.set('Retry-After', String(retrySec));
            return res.status(429).json({
                error:
                    'Alcanzaste el límite de generaciones con IA en este período. Espera unos minutos antes de volver a generar (texto SEO, narrativa, JSON-LD, plan de fotos, etc.).',
                code: 'AI_PANEL_RATE_LIMIT_HEAVY',
                retryAfterSeconds: retrySec,
                limit: HEAVY_MAX,
                windowMs: WINDOW_MS,
            });
        }
    } else {
        row.light += 1;
        if (row.light > LIGHT_MAX) {
            const retrySec = Math.max(1, Math.ceil((WINDOW_MS - (now - row.start)) / 1000));
            res.set('Retry-After', String(retrySec));
            return res.status(429).json({
                error:
                    'Demasiadas solicitudes de IA por subida de imágenes o auditoría en este período. Espera unos minutos.',
                code: 'AI_PANEL_RATE_LIMIT_LIGHT',
                retryAfterSeconds: retrySec,
                limit: LIGHT_MAX,
                windowMs: WINDOW_MS,
            });
        }
    }

    next();
}

module.exports = { aiPanelGenerationLimiter, classifyRoute, WINDOW_MS, HEAVY_MAX, LIGHT_MAX };
