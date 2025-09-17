const express = require('express');
const {
    crearConversion,
    obtenerConversionesPorEmpresa,
    actualizarConversion,
    eliminarConversion
} = require('../services/conversionesService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const nuevaConversion = await crearConversion(db, empresaId, req.body);
            res.status(201).json(nuevaConversion);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const conversiones = await obtenerConversionesPorEmpresa(db, empresaId);
            res.status(200).json(conversiones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const conversionActualizada = await actualizarConversion(db, empresaId, id, req.body);
            res.status(200).json(conversionActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarConversion(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};