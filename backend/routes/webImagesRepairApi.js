/**
 * Panel: regenerar miniaturas web (misma lógica que scripts/tooling/repair-web-images.js).
 * POST /api/website/maintenance/regenerate-web-images — body opcional: force, propiedadId, recompressHeroFull.
 */
const express = require('express');
const pool = require('../db/postgres');
const { IS_POSTGRES } = require('../config/dbConfig');
const { runWebImagesRepair } = require('../services/webImagesRepairService');
const { runPrepareSeoPipeline } = require('../services/photoSeoGateService');

const COOLDOWN_MS = 3 * 60 * 1000;
const lastRunByEmpresa = new Map();

/** Cooldown más corto solo para Contenido Web → paso 2 → SEO (por alojamiento). */
const WIZARD_PREP_COOLDOWN_MS = 45 * 1000;
const lastWizardPrepByPropiedad = new Map();

function createRouter() {
    const router = express.Router();

    /**
     * Wizard Contenido Web (paso Fotos): misma lógica que regenerate-web-images pero
     * acotada al alojamiento + hero empresa (miniaturas PageSpeed). Sin cooldown global de 3 min.
     */
    router.post('/propiedad/:propiedadId/prepare-for-seo-step', async (req, res) => {
        const empresaId = req.user?.empresaId;
        const propiedadId = String(req.params.propiedadId || '').trim();
        if (!empresaId) {
            return res.status(403).json({ error: 'Sesión sin empresa.' });
        }
        if (!propiedadId) {
            return res.status(400).json({ error: 'propiedadId requerido.' });
        }
        if (!IS_POSTGRES || !pool) {
            return res.status(503).json({ error: 'Esta operación requiere PostgreSQL.' });
        }

        const { rows } = await pool.query(
            'SELECT 1 FROM propiedades WHERE empresa_id = $1 AND id = $2',
            [empresaId, propiedadId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Alojamiento no encontrado.' });
        }

        const now = Date.now();
        const prepKey = `${empresaId}:${propiedadId}`;
        const prevPrep = lastWizardPrepByPropiedad.get(prepKey);
        if (prevPrep && now - prevPrep < WIZARD_PREP_COOLDOWN_MS) {
            const sec = Math.ceil((WIZARD_PREP_COOLDOWN_MS - (now - prevPrep)) / 1000);
            return res.status(429).json({
                error: `Espera ${sec}s antes de volver a ejecutar en este alojamiento.`,
                retryAfterSeconds: sec,
            });
        }

        const force = Boolean(req.body && req.body.force);

        try {
            await runPrepareSeoPipeline({ empresaId, propiedadId });
            const result = await runWebImagesRepair({
                empresaId,
                apply: true,
                force,
                propiedadId,
                log: (line) => console.log(`[prepare-for-seo-step ${empresaId.slice(0, 8)}…/${propiedadId.slice(0, 8)}] ${line}`),
            });
            lastWizardPrepByPropiedad.set(prepKey, Date.now());
            return res.json({ ok: true, ...result });
        } catch (err) {
            console.error('[prepare-for-seo-step]', err);
            if (err.statusCode === 409 && err.code === 'PHOTO_PLAN_INCOMPLETE') {
                return res.status(409).json({
                    error: err.message,
                    code: err.code,
                    ...(err.data || {}),
                });
            }
            const code = err.code === 'PG_REQUIRED' ? 503 : err.statusCode === 404 ? 404 : 500;
            return res.status(code).json({
                error: err.message || 'No se pudo preparar fotos para SEO.',
            });
        }
    });

    router.post('/maintenance/regenerate-web-images', async (req, res) => {
        const empresaId = req.user?.empresaId;
        if (!empresaId) {
            return res.status(403).json({ error: 'Sesión sin empresa.' });
        }
        if (!IS_POSTGRES || !pool) {
            return res.status(503).json({ error: 'Esta operación requiere PostgreSQL.' });
        }

        const now = Date.now();
        const prev = lastRunByEmpresa.get(empresaId);
        if (prev && now - prev < COOLDOWN_MS) {
            const sec = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
            return res.status(429).json({
                error: `Espera ${sec}s antes de volver a ejecutar (evita sobrecarga).`,
                retryAfterSeconds: sec,
            });
        }

        const force = Boolean(req.body && req.body.force);
        const recompressHeroFull = Boolean(req.body && req.body.recompressHeroFull);
        let propiedadId = '';
        if (req.body && req.body.propiedadId != null) {
            propiedadId = String(req.body.propiedadId).trim();
        }

        try {
            const result = await runWebImagesRepair({
                empresaId,
                apply: true,
                force,
                recompressHeroFull,
                propiedadId: propiedadId || undefined,
                log: (line) => console.log(`[repair-web-images-api ${empresaId.slice(0, 8)}…] ${line}`),
            });
            lastRunByEmpresa.set(empresaId, Date.now());
            return res.json({ ok: true, ...result });
        } catch (err) {
            console.error('[maintenance/regenerate-web-images]', err);
            const code = err.code === 'PG_REQUIRED' ? 503 : 500;
            return res.status(code).json({
                error: err.message || 'No se pudieron regenerar las miniaturas.',
            });
        }
    });

    return router;
}

module.exports = function webImagesRepairApiRoutes(/* db — Firestore no usado; repair usa solo PG + Storage */) {
    return createRouter();
};
