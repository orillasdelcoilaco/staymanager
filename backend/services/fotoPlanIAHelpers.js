/**
 * Normaliza la salida de IA para el plan de fotos y rellena huecos con generarPlanFotos.
 */
const { generarPlanFotos } = require('./propiedadLogicService');

/** Quita envoltorios habituales ({ plan: {...} }) o arrays [{ id, shots }]. */
function unwrapFotoPlanRaw(raw) {
    if (raw == null || typeof raw !== 'object') return null;
    if (Array.isArray(raw)) {
        const out = {};
        for (const row of raw) {
            if (!row || typeof row !== 'object') continue;
            const id = row.id ?? row.componentId ?? row.espacioId ?? row.spaceId;
            const shots = row.shots ?? row.plan ?? row.fotos ?? row.slots;
            if (id != null && Array.isArray(shots)) {
                out[String(id)] = shots;
            }
        }
        return Object.keys(out).length ? out : null;
    }
    const nested =
        raw.plan ?? raw.fotoPlan ?? raw.fotoPlanIA ?? raw.photoPlan ?? raw.planes
        ?? raw.data ?? raw.result ?? raw.response;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested;
    }
    const skip = new Set(['_aiGenerated', '_generatedAt', '_slotsTotal', '_slotsCumplidos']);
    const flat = {};
    for (const [k, v] of Object.entries(raw)) {
        if (skip.has(k)) continue;
        flat[k] = v;
    }
    return flat;
}

function resolveEspacioId(key, espacios) {
    const ks = String(key).trim();
    for (const e of espacios) {
        if (String(e.id) === ks) return e.id;
    }
    const lower = ks.toLowerCase();
    for (const e of espacios) {
        const nom = String(e.nombre || '').trim().toLowerCase();
        if (nom && nom === lower) return e.id;
    }
    return null;
}

function normalizeShot(s) {
    if (typeof s === 'string') {
        return {
            description: s.slice(0, 140),
            guidelines: null,
            priority: 'Media',
            required: false,
        };
    }
    if (!s || typeof s !== 'object') {
        return {
            description: 'Vista general',
            guidelines: null,
            priority: 'Media',
            required: false,
        };
    }
    const description = String(s.description ?? s.desc ?? s.shot ?? s.title ?? 'Vista general').trim().slice(0, 220)
        || 'Vista general';
    const guidelines = s.guidelines ?? s.guia ?? s.notas ?? null;
    return {
        description,
        guidelines: guidelines != null ? String(guidelines).slice(0, 600) : null,
        priority: s.priority || 'Media',
        required: Boolean(s.required),
    };
}

/**
 * @param {object|null} planRaw - JSON devuelto por la IA
 * @param {Array<{id,nombre}>} espacios
 * @param {Array} componentes - propiedad.componentes
 * @param {Array} tiposElemento
 * @returns {{ planValidado: Record<string, Array>, aiContributed: boolean }}
 */
function buildFotoPlanWithFallback(planRaw, espacios, componentes, tiposElemento) {
    // La IA define prioridades SSR/venta; el fallback por reglas solo añade “vista general” por espacio
    // (no un slot por cada activo con requires_photo — eso saturaba el plan).
    const rulePlanRaw = generarPlanFotos(componentes || [], [], tiposElemento || [], {
        soloVistaGeneralPorEspacio: true,
    });
    /** Misma clave string que usa json.stringify en PG / frontend para evitar fallos de lookup UUID vs string */
    const rulePlan = {};
    for (const [k, shots] of Object.entries(rulePlanRaw)) {
        rulePlan[String(k)] = shots;
    }

    let aiContributed = false;
    const planValidado = {};

    const unwrapped = unwrapFotoPlanRaw(planRaw);
    const source = unwrapped && typeof unwrapped === 'object' ? unwrapped : {};

    for (const [key, shots] of Object.entries(source)) {
        if (!Array.isArray(shots)) continue;
        const resolvedId = resolveEspacioId(key, espacios);
        if (resolvedId == null) continue;
        const normalizedShots = shots.map(normalizeShot).filter((sh) => String(sh.description || '').trim());
        if (normalizedShots.length) {
            planValidado[String(resolvedId)] = normalizedShots;
            aiContributed = true;
        }
    }

    for (const e of espacios) {
        const kid = e.id == null ? null : String(e.id);
        if (kid == null) continue;
        if (!planValidado[kid] || planValidado[kid].length === 0) {
            const fb = rulePlan[kid];
            if (fb && fb.length) {
                planValidado[kid] = fb.map((shot) => ({
                    description: shot.description || shot.shot || 'Vista general',
                    guidelines: shot.guidelines || null,
                    priority: shot.priority || 'Media',
                    required: shot.required !== false,
                }));
            }
        }
    }

    return { planValidado, aiContributed };
}

module.exports = {
    buildFotoPlanWithFallback,
    unwrapFotoPlanRaw,
};
