// backend/routes/propiedades.js
const express = require('express');
const {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    actualizarPropiedad,
    eliminarPropiedad,
    clonarPropiedad
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
            console.log(`[API START] PUT /propiedades/${id} - Payload size: ${JSON.stringify(req.body).length}`);

            const propiedadActualizada = await actualizarPropiedad(db, empresaId, id, req.body);

            console.log(`[API SUCCESS] PUT /propiedades/${id} - Updated OK`);
            res.status(200).json(propiedadActualizada);
        } catch (error) {
            console.error(`[API CRITICAL FAIL] PUT /propiedades/${req.params.id}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/:id/clonar', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const { name } = req.body; // Arquitectura: Recibir nombre opcional
            const nuevaPropiedad = await clonarPropiedad(db, empresaId, id, name);
            res.status(201).json(nuevaPropiedad);
        } catch (error) {
            console.error("Error al clonar propiedad:", error);
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