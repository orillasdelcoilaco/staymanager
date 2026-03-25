// backend/routes/resenas.js
const express = require('express');
const {
    obtenerResenas,
    obtenerResumenResenas,
    guardarResena,
    responderResena,
    cambiarEstado
} = require('../services/resenasService');
const { obtenerEmailReenvio } = require('../services/emailInboundService');

module.exports = (db) => {
    const router = express.Router();

    // GET /api/resenas/config — dirección de reenvío para esta empresa
    router.get('/config', (req, res) => {
        res.json({ emailReenvio: obtenerEmailReenvio(req.user.empresaId) });
    });

    // GET /api/resenas — listado con filtros opcionales
    router.get('/', async (req, res) => {
        try {
            const { estado, propiedadId, canal, limite, offset } = req.query;
            const resenas = await obtenerResenas(req.user.empresaId, {
                estado, propiedadId, canal,
                limite: parseInt(limite) || 50,
                offset: parseInt(offset) || 0
            });
            res.json(resenas);
        } catch (err) {
            console.error('[resenas] GET /', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/resenas/resumen — KPIs por canal
    router.get('/resumen', async (req, res) => {
        try {
            const resumen = await obtenerResumenResenas(req.user.empresaId);
            res.json(resumen);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/resenas — ingreso manual
    router.post('/', async (req, res) => {
        try {
            const result = await guardarResena(req.user.empresaId, req.body);
            res.status(result.nueva ? 201 : 200).json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/responder
    router.put('/:id/responder', async (req, res) => {
        try {
            const { respuesta } = req.body;
            if (!respuesta) return res.status(400).json({ error: 'Falta el texto de respuesta' });
            const resena = await responderResena(req.user.empresaId, req.params.id, respuesta);
            res.json(resena);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/estado
    router.put('/:id/estado', async (req, res) => {
        try {
            const { estado } = req.body;
            const resena = await cambiarEstado(req.user.empresaId, req.params.id, estado);
            res.json(resena);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    return router;
};
