const express = require('express');
const {
    crearTipoPlantilla,
    obtenerTiposPlantilla,
    actualizarTipoPlantilla,
    eliminarTipoPlantilla,
    crearPlantilla,
    obtenerPlantillasPorEmpresa,
    actualizarPlantilla,
    eliminarPlantilla
} = require('../services/plantillasService');

module.exports = (db) => {
    const router = express.Router();

    // --- Rutas para Tipos de Plantilla ---
    router.post('/tipos', async (req, res) => {
        try {
            const nuevoTipo = await crearTipoPlantilla(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoTipo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/tipos', async (req, res) => {
        try {
            const tipos = await obtenerTiposPlantilla(db, req.user.empresaId);
            res.status(200).json(tipos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/tipos/:id', async (req, res) => {
        try {
            const tipoActualizado = await actualizarTipoPlantilla(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(tipoActualizado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/tipos/:id', async (req, res) => {
        try {
            await eliminarTipoPlantilla(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // --- Rutas para Plantillas de Mensajes ---
    router.post('/', async (req, res) => {
        try {
            const nuevaPlantilla = await crearPlantilla(db, req.user.empresaId, req.body);
            res.status(201).json(nuevaPlantilla);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const plantillas = await obtenerPlantillasPorEmpresa(db, req.user.empresaId);
            res.status(200).json(plantillas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const plantillaActualizada = await actualizarPlantilla(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(plantillaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarPlantilla(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};