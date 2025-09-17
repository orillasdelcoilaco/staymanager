const express = require('express');
const {
    crearCanal,
    obtenerCanalesPorEmpresa,
    actualizarCanal,
    eliminarCanal
} = require('../services/canalesService');

// La clave es exportar una función que recibe 'db' y devuelve el router
module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const nuevoCanal = await crearCanal(db, empresaId, req.body);
            res.status(201).json(nuevoCanal);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const canales = await obtenerCanalesPorEmpresa(db, empresaId);
            res.status(200).json(canales);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const canalActualizado = await actualizarCanal(db, empresaId, id, req.body);
            res.status(200).json(canalActualizado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarCanal(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};