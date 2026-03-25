// backend/routes/bloqueosRoutes.js
const express = require('express');
const { crearBloqueo, listarBloqueos, eliminarBloqueo } = require('../services/bloqueosService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            res.json(await listarBloqueos(db, empresaId));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { empresaId, email } = req.user;
            const bloqueo = await crearBloqueo(db, empresaId, req.body, email);
            res.status(201).json(bloqueo);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            await eliminarBloqueo(db, empresaId, req.params.id);
            res.json({ ok: true });
        } catch (err) {
            res.status(404).json({ error: err.message });
        }
    });

    return router;
};
