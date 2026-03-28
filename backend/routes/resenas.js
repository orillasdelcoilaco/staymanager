// backend/routes/resenas.js
const express = require('express');
const {
    generarTokenParaReserva,
    obtenerResenas,
    obtenerResumen,
    responderResena,
    cambiarEstado
} = require('../services/resenasService');

module.exports = (db) => {
    const router = express.Router();

    // POST /api/resenas/generar-token — genera (o recupera) el token de reseña para una reserva
    router.post('/generar-token', async (req, res) => {
        const { reservaId, propiedadId, nombreHuesped } = req.body;
        if (!reservaId) return res.status(400).json({ error: 'reservaId requerido' });
        try {
            const token = await generarTokenParaReserva(
                req.user.empresaId, reservaId, propiedadId, nombreHuesped
            );
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            res.json({ token, url: `${baseUrl}/r/${token}` });
        } catch (err) {
            console.error('[resenas] generar-token:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/resenas — lista de reseñas con filtros
    router.get('/', async (req, res) => {
        try {
            const resenas = await obtenerResenas(req.user.empresaId, {
                estado: req.query.estado || null,
                propiedadId: req.query.propiedadId || null
            });
            res.json(resenas);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/resenas/resumen — KPIs agregados
    router.get('/resumen', async (req, res) => {
        try {
            const resumen = await obtenerResumen(req.user.empresaId);
            res.json(resumen);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/responder — respuesta del anfitrión
    router.put('/:id/responder', async (req, res) => {
        const { texto } = req.body;
        if (!texto?.trim()) return res.status(400).json({ error: 'texto requerido' });
        try {
            const result = await responderResena(
                req.params.id, req.user.empresaId, texto.trim(), req.user.email
            );
            if (!result) return res.status(404).json({ error: 'Reseña no encontrada' });
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/estado — publicar / ocultar / pendiente
    router.put('/:id/estado', async (req, res) => {
        const { estado } = req.body;
        if (!['pendiente', 'publicada', 'oculta'].includes(estado)) {
            return res.status(400).json({ error: 'estado inválido' });
        }
        try {
            const result = await cambiarEstado(req.params.id, req.user.empresaId, estado);
            if (!result) return res.status(404).json({ error: 'Reseña no encontrada' });
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
