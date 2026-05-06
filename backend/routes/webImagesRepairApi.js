/**
 * Panel: regenerar miniaturas web (misma lógica que scripts/tooling/repair-web-images.js).
 * POST /api/website/maintenance/regenerate-web-images — empresa solo desde JWT.
 */
const express = require('express');
const pool = require('../db/postgres');
const { IS_POSTGRES } = require('../config/dbConfig');
const { runWebImagesRepair } = require('../services/webImagesRepairService');

const COOLDOWN_MS = 3 * 60 * 1000;
const lastRunByEmpresa = new Map();

function createRouter() {
    const router = express.Router();

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
        let propiedadId = '';
        if (req.body && req.body.propiedadId != null) {
            propiedadId = String(req.body.propiedadId).trim();
        }

        try {
            const result = await runWebImagesRepair({
                empresaId,
                apply: true,
                force,
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
