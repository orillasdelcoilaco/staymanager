/**
 * Validación previa al paso SEO en Contenido Web: plan de fotos cumplido y purga estricta.
 * Cualquier foto activa que carezca de datos mínimos para SSR o de confianza aceptable
 * (según el análisis ya persistido en BD al auditar/importar la foto) se elimina (multi-tenant PG).
 *
 * No usa variables de entorno ni configuración por empresa: el umbral es lógica de producto en código.
 * El campo `confianza` refleja la decisión numérica del pipeline de IA/análisis previo, no un ajuste manual del usuario final.
 */
const pool = require('../db/postgres');
const { IS_POSTGRES } = require('../config/dbConfig');
const { generarPlanFotos } = require('./propiedadLogicService');
const { eliminarFoto } = require('./galeriaService');
const { obtenerPropiedadPorId, actualizarPropiedad } = require('./propiedadesService');
const { ssrCache } = require('./cacheService');

/**
 * Límite fijo de producto sobre `galeria.confianza` (0–1), ya calculado por el análisis al subir o auditar la foto.
 * Por debajo: se considera que el pipeline automático ya marcó la foto como insuficiente para publicación SSR.
 */
const MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE = 0.55;

/**
 * @returns {string|null} código de rechazo o null si la fila es válida para SSR
 */
function evaluatePhotoRowForStrictSSR(row) {
    const full = String(row.storage_url || '').trim();
    const thumb = String(row.thumbnail_url || '').trim();
    if (!full) return 'MISSING_STORAGE_URL';
    if (!thumb || thumb === full) return 'INVALID_THUMBNAIL_PAIR';
    if (row.espacio_id == null || row.espacio_id === '') return 'MISSING_ESPACIO';

    const raw = row.confianza;
    if (raw === null || raw === undefined || raw === '') return 'MISSING_CONFIDENCE';
    const conf = typeof raw === 'number' ? raw : parseFloat(raw, 10);
    if (Number.isNaN(conf)) return 'MISSING_CONFIDENCE';
    if (conf < MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE) return 'LOW_CONFIDENCE';
    return null;
}

function resolvePhotoPlan(propiedad) {
    const planIA = propiedad.fotoPlanIA || null;
    const plan = planIA ? planIA : generarPlanFotos(propiedad.componentes || [], []);
    return plan;
}

function computePhotoPlanSlots(propiedad) {
    const plan = resolvePhotoPlan(propiedad);
    const slotsTotal = Object.values(plan).reduce((s, shots) => s + shots.length, 0);
    const wizardImages = propiedad.websiteData?.images || {};
    const slotsCumplidos = Object.entries(plan).reduce((sum, [cId, shots]) => {
        const imgs = wizardImages[cId] || [];
        const cap = Array.isArray(shots) ? shots.length : 0;
        return sum + Math.min((Array.isArray(imgs) ? imgs.length : 0), cap);
    }, 0);
    const complete = slotsTotal === 0 || slotsCumplidos >= slotsTotal;
    return { plan, slotsTotal, slotsCumplidos, complete };
}

async function recalcularFotoStatsPg(empresaId, propiedadId, componentes, wizardImages) {
    try {
        const { obtenerTiposPorEmpresa } = require('./componentesService');
        const tipos = await obtenerTiposPorEmpresa(null, empresaId);
        const plan = generarPlanFotos(componentes || [], tipos);
        const slotsTotal = Object.values(plan).reduce((s, shots) => s + shots.length, 0);
        const imgs = wizardImages || {};
        const slotsCumplidos = Object.entries(plan).reduce((s, [compId, slots]) => {
            return s + Math.min((imgs[compId] || []).length, slots.length);
        }, 0);
        if (pool && slotsTotal > 0) {
            await pool.query(
                `UPDATE propiedades
                 SET metadata = metadata || jsonb_build_object('fotoStats', $1::jsonb)
                 WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify({ slotsTotal, slotsCumplidos }), propiedadId, empresaId]
            );
        }
    } catch (err) {
        console.warn('[photoSeoGateService] fotoStats:', err.message);
    }
}

async function stripDeletedFromWebsiteData(empresaId, propiedadId, deletedIds) {
    if (!deletedIds.length) return;
    const propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
    if (!propiedad) return;
    const drop = new Set(deletedIds.map(String));
    const wd = { ...(propiedad.websiteData || {}) };
    const images = { ...(wd.images || {}) };
    for (const compId of Object.keys(images)) {
        const arr = images[compId];
        if (!Array.isArray(arr)) continue;
        images[compId] = arr.filter((img) => img && !drop.has(String(img.imageId)));
    }
    wd.images = images;
    if (wd.cardImage?.imageId && drop.has(String(wd.cardImage.imageId))) {
        wd.cardImage = null;
    }
    await actualizarPropiedad(null, empresaId, propiedadId, { websiteData: wd });
}

async function purgePhotosFailingStrictSeoGate(empresaId, propiedadId) {
    const deleted = [];
    if (!IS_POSTGRES || !pool) return { deleted };

    const { rows } = await pool.query(
        `SELECT id, storage_url, thumbnail_url, espacio_id, confianza, estado
         FROM galeria
         WHERE empresa_id = $1 AND propiedad_id = $2 AND estado IN ('auto', 'manual')`,
        [empresaId, propiedadId]
    );

    for (const r of rows) {
        const why = evaluatePhotoRowForStrictSSR(r);
        if (!why) continue;
        try {
            await eliminarFoto(null, empresaId, propiedadId, r.id);
            deleted.push({
                id: r.id,
                reason: why,
                estado: r.estado,
                confianza: r.confianza,
            });
        } catch (e) {
            console.warn(`[photoSeoGateService] no se eliminó ${r.id}:`, e.message);
        }
    }

    if (deleted.length) {
        await stripDeletedFromWebsiteData(
            empresaId,
            propiedadId,
            deleted.map((d) => d.id)
        );
    }

    return { deleted };
}

async function persistPhotoSeoBlocked(empresaId, propiedadId, payload) {
    const propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
    if (!propiedad) return;
    const wd = { ...(propiedad.websiteData || {}) };
    wd.photoSeoBlocked = {
        at: new Date().toISOString(),
        ...payload,
    };
    await actualizarPropiedad(null, empresaId, propiedadId, { websiteData: wd });
    try {
        ssrCache.invalidateEmpresaCache(empresaId);
    } catch (e) {
        console.warn('[photoSeoGateService] cache:', e.message);
    }
}

async function clearPhotoSeoBlocked(empresaId, propiedadId) {
    const propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
    if (!propiedad?.websiteData?.photoSeoBlocked) return;
    await actualizarPropiedad(null, empresaId, propiedadId, {
        websiteData: { photoSeoBlocked: null },
    });
}

function buildIncompleteMessage(slots, purgeSummary) {
    const gap = Math.max(0, slots.slotsTotal - slots.slotsCumplidos);
    let msg = `Completa el plan de fotos antes de SEO (${slots.slotsCumplidos}/${slots.slotsTotal} tomas).`;
    if (gap > 0) msg += ` Faltan ${gap} toma(s).`;
    if (purgeSummary?.length) {
        msg += ` Se eliminaron ${purgeSummary.length} foto(s) que no superan el análisis de calidad guardado, o carecen de datos mínimos para el sitio público. Sube nuevas fotos.`;
    }
    return msg;
}

/**
 * Purga fotos IA débiles, recalcula stats y bloquea si el plan no está cumplido.
 * Si todo OK, limpia photoSeoBlocked. La llamada a repair/web images va después.
 *
 * @throws {Error} statusCode 409 si plan incompleto
 */
async function runPrepareSeoPipeline({ empresaId, propiedadId }) {
    if (!IS_POSTGRES || !pool) {
        const e = new Error('Esta operación requiere PostgreSQL.');
        e.code = 'PG_REQUIRED';
        e.statusCode = 503;
        throw e;
    }

    let propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
    if (!propiedad) {
        const e = new Error('Alojamiento no encontrado.');
        e.statusCode = 404;
        throw e;
    }

    const purgeResult = await purgePhotosFailingStrictSeoGate(empresaId, propiedadId);

    if (purgeResult.deleted.length) {
        propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
        await recalcularFotoStatsPg(
            empresaId,
            propiedadId,
            propiedad.componentes,
            propiedad.websiteData?.images
        );
    }

    const slots = computePhotoPlanSlots(propiedad);

    if (!slots.complete && slots.slotsTotal > 0) {
        const summary = buildIncompleteMessage(slots, purgeResult.deleted);
        await persistPhotoSeoBlocked(empresaId, propiedadId, {
            reason: 'PHOTO_PLAN_INCOMPLETE',
            code: 'PHOTO_PLAN_INCOMPLETE',
            summary,
            slotsTotal: slots.slotsTotal,
            slotsCumplidos: slots.slotsCumplidos,
            purgeRemoved: purgeResult.deleted.length,
        });
        const err = new Error(summary);
        err.code = 'PHOTO_PLAN_INCOMPLETE';
        err.statusCode = 409;
        err.data = {
            slots,
            purgeResult,
            photoSeoBlocked: { summary, reason: 'PHOTO_PLAN_INCOMPLETE' },
        };
        throw err;
    }

    await clearPhotoSeoBlocked(empresaId, propiedadId);
    return { purgeResult, slots };
}

module.exports = {
    runPrepareSeoPipeline,
    computePhotoPlanSlots,
    evaluatePhotoRowForStrictSSR,
    MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE,
    /** @deprecated mismo valor que MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE */
    MIN_CONFIDENCE_SSR: MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE,
    MIN_AUTO_CONFIDENCE: MIN_CONFIDENCE_FROM_ANALYSIS_PIPELINE,
};
