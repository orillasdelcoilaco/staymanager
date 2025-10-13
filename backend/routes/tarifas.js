const express = require('express');
const {
    crearTarifa,
    obtenerTarifasPorEmpresa,
    actualizarTarifa,
    eliminarTarifa
} = require('../services/tarifasService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const nuevaTarifa = await crearTarifa(db, empresaId, req.body);
            res.status(201).json(nuevaTarifa);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const tarifas = await obtenerTarifasPorEmpresa(db, empresaId);
            res.status(200).json(tarifas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            console.log(`[DEBUG Backend Route] PUT /api/tarifas/${req.params.id}`);
            console.log('[DEBUG Backend Route] Body recibido:', JSON.stringify(req.body, null, 2));
            const { empresaId } = req.user;
            const { id } = req.params;
            const tarifaActualizada = await actualizarTarifa(db, empresaId, id, req.body);
            res.status(200).json(tarifaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarTarifa(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};