// backend/routes/amenidades.js
const express = require('express');
const amenidadesService = require('../services/amenidadesService');

module.exports = (db) => {
    const router = express.Router();

    const getEmpresaId = (req) => {
        return req.headers['x-empresa-id'] || (req.user && req.user.empresaId);
    };

    router.get('/', async (req, res) => {
        try {
            const empresaId = getEmpresaId(req);
            if (!empresaId) return res.status(400).json({ error: 'Falta empresa-id' });

            const tipos = await amenidadesService.obtenerTipos(db, empresaId);
            res.json(tipos);
        } catch (error) {
            console.error('Error al obtener amenidades:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const empresaId = getEmpresaId(req);
            if (!empresaId) return res.status(400).json({ error: 'Falta empresa-id' });

            const nuevoTipo = await amenidadesService.crearTipo(db, empresaId, req.body);
            res.json(nuevoTipo);
        } catch (error) {
            console.error('Error al crear amenidad:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const empresaId = getEmpresaId(req);
            if (!empresaId) return res.status(400).json({ error: 'Falta empresa-id' });

            await amenidadesService.eliminarTipo(db, empresaId, req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar amenidad:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
