// backend/routes/propiedades.js
const express = require('express');
const {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    actualizarPropiedad,
    eliminarPropiedad
} = require('../services/propiedadesService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const nuevaPropiedad = await crearPropiedad(db, empresaId, req.body);
            res.status(201).json(nuevaPropiedad);
        } catch (error) {
            console.error("Error al crear propiedad:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
            res.status(200).json(propiedades);
        } catch (error) {
            console.error("Error al obtener propiedades:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const propiedadActualizada = await actualizarPropiedad(db, empresaId, id, req.body);
            res.status(200).json(propiedadActualizada);
        } catch (error) {
            console.error("Error al actualizar propiedad:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarPropiedad(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            console.error("Error al eliminar propiedad:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};