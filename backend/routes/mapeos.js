const express = require('express');
const {
    guardarMapeo,
    obtenerMapeosPorEmpresa,
    eliminarMapeo
} = require('../services/mapeosService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const mapeos = await obtenerMapeosPorEmpresa(db, req.user.empresaId);
            res.status(200).json(mapeos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const nuevoMapeo = await guardarMapeo(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoMapeo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    router.delete('/:id', async (req, res) => {
        try {
            await eliminarMapeo(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};