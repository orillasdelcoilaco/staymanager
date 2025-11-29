const express = require('express');
const tiposElementoService = require('../services/tiposElementoService');

module.exports = (db) => {
    const router = express.Router();

    // GET /tipos-elemento
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const tipos = await tiposElementoService.obtenerTipos(db, empresaId);
            res.json(tipos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /tipos-elemento
    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datos = req.body;

            if (!datos.nombre || !datos.categoria) {
                return res.status(400).json({ error: 'Nombre y categoría son obligatorios.' });
            }

            const nuevoTipo = await tiposElementoService.crearTipo(db, empresaId, datos);
            res.status(201).json(nuevoTipo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /tipos-elemento/:id
    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await tiposElementoService.eliminarTipo(db, empresaId, id);
            res.json({ message: 'Tipo de elemento eliminado correctamente.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
