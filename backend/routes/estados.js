// backend/routes/estados.js
const express = require('express');
const {
    crearEstado,
    obtenerEstados,
    actualizarEstado,
    eliminarEstado
} = require('../services/estadosService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        try {
            const nuevoEstado = await crearEstado(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoEstado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const estados = await obtenerEstados(db, req.user.empresaId);
            res.status(200).json(estados);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const estadoActualizado = await actualizarEstado(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(estadoActualizado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarEstado(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};