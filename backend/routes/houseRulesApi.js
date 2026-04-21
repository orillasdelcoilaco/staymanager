/**
 * API de normas del alojamiento (empresa + por propiedad).
 * Montaje típico: /api/propiedades/house-rules y /api/website/house-rules (alias).
 */
const { sanitizeHouseRules, mergeEffectiveRules } = require('../services/houseRulesService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
const {
    obtenerPropiedadPorId,
    actualizarPropiedad,
    obtenerPropiedadesPorEmpresa,
} = require('../services/propiedadesService');
const { ssrCache } = require('../services/cacheService');

function invalidateSsrCache(empresaId) {
    try {
        if (empresaId) ssrCache.invalidateEmpresaCache(empresaId);
    } catch (err) {
        console.warn(`[SSR cache] No se pudo invalidar cache para ${empresaId}: ${err.message}`);
    }
}

async function getHouseRulesBootstrap(db, req, res, next) {
    try {
        const { empresaId } = req.user;
        const [empresa, propiedades] = await Promise.all([
            obtenerDetallesEmpresa(db, empresaId),
            obtenerPropiedadesPorEmpresa(db, empresaId),
        ]);
        const empresaDefaults = empresa.websiteSettings?.houseRules || null;
        const lista = (propiedades || []).map((p) => ({
            id: p.id,
            nombre: p.nombre,
            normasAlojamiento: p.normasAlojamiento || null,
            reglasEfectivas: mergeEffectiveRules(empresaDefaults, p.normasAlojamiento || {}),
        }));
        res.status(200).json({ empresaDefaults, propiedades: lista });
    } catch (error) {
        next(error);
    }
}

async function putHouseRulesDefaults(db, req, res, next) {
    try {
        const { empresaId } = req.user;
        const empresa = await obtenerDetallesEmpresa(db, empresaId);
        const prev = empresa.websiteSettings?.houseRules || null;
        const sanitized = sanitizeHouseRules(req.body || {}, prev);
        await actualizarDetallesEmpresa(db, empresaId, {
            websiteSettings: { houseRules: sanitized },
        });
        invalidateSsrCache(empresaId);
        res.status(200).json({ ok: true, houseRules: sanitized });
    } catch (error) {
        next(error);
    }
}

async function putHouseRulesPropiedad(db, req, res, next) {
    try {
        const { empresaId } = req.user;
        const { propiedadId } = req.params;
        const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
        if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
        const prev = propiedad.normasAlojamiento || null;
        const sanitized = sanitizeHouseRules(req.body || {}, prev);
        await actualizarPropiedad(db, empresaId, propiedadId, { normasAlojamiento: sanitized });
        invalidateSsrCache(empresaId);
        res.status(200).json({ ok: true, normasAlojamiento: sanitized });
    } catch (error) {
        next(error);
    }
}

function mountOnRouter(router, db) {
    router.get('/house-rules', (req, res, next) => getHouseRulesBootstrap(db, req, res, next));
    router.put('/house-rules/defaults', (req, res, next) => putHouseRulesDefaults(db, req, res, next));
    router.put('/house-rules/propiedad/:propiedadId', (req, res, next) => putHouseRulesPropiedad(db, req, res, next));
}

module.exports = {
    getHouseRulesBootstrap,
    putHouseRulesDefaults,
    putHouseRulesPropiedad,
    mountOnRouter,
};
