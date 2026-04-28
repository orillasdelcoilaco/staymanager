// backend/routes/comunicaciones.js
// Bandeja de comunicaciones por empresa (SPA autenticada).
const express = require('express');
const { listarComunicacionesEmpresa, listarHilosComunicacionesEmpresa } = require('../services/comunicacionesService');
const { reintentarComunicacionEmail, reintentarComunicacionesEmailLote } = require('../services/comunicacionesRetryService');

module.exports = () => {
    const router = express.Router();

    /** Debe ir antes de /:id/reintentar para no capturar "reintentar" como id. */
    router.post('/reintentar', async (req, res) => {
        try {
            const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : [];
            const out = await reintentarComunicacionesEmailLote(null, req.user.empresaId, ids);
            res.status(200).json(out);
        } catch (e) {
            const code = e.code || '';
            const status = code === 'EMPTY' ? 400 : 500;
            res.status(status).json({ error: e.message || 'Error al reintentar lote', code });
        }
    });

    router.post('/:id/reintentar', async (req, res) => {
        try {
            const out = await reintentarComunicacionEmail(null, req.user.empresaId, req.params.id);
            res.status(200).json(out);
        } catch (e) {
            const code = e.code || '';
            const status = code === 'NOT_FOUND' ? 404
                : code === 'SEND_FAILED' ? 502
                    : (['BAD_STATE', 'BAD_TYPE', 'NO_CLIENTE', 'NO_RELACION_RESERVA', 'NO_STRATEGY'].includes(code) ? 400
                        : code === 'RESERVA_NOT_FOUND' ? 422 : 500);
            res.status(status).json({ error: e.message || 'Error al reintentar', code });
        }
    });

    router.get('/hilos', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { limit, offset, q } = req.query;
            const data = await listarHilosComunicacionesEmpresa(null, empresaId, {
                limit, offset, busqueda: q,
            });
            res.json(data);
        } catch (e) {
            console.error('[comunicaciones/hilos]', e);
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const {
                limit, offset, evento, estado, clienteId, q, tipo,
                relacionTipo, relacionId, grupoSinRelacion,
            } = req.query;
            const gsr = grupoSinRelacion === '1' || grupoSinRelacion === 'true';
            const data = await listarComunicacionesEmpresa(null, empresaId, {
                limit,
                offset,
                evento,
                estado,
                clienteId,
                busqueda: q,
                tipo,
                relacionTipo,
                relacionId,
                grupoSinRelacion: gsr,
            });
            res.json(data);
        } catch (e) {
            console.error('[comunicaciones]', e);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
