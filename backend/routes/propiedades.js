const express = require('express');
const {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    actualizarPropiedad,
    eliminarPropiedad
} = require('../services/propiedadesService');

module.exports = (db) => {
    const router = express.Router();

    // POST /api/propiedades - Crear una nueva propiedad
    router.post('/', async (req, res) => {
        try {
            // El empresaId viene del authMiddleware, asegurando que el usuario solo puede crear en su propia empresa
            const { empresaId } = req.user;
            const nuevaPropiedad = await crearPropiedad(db, empresaId, req.body);
            res.status(201).json(nuevaPropiedad);
        } catch (error) {
            console.error("Error al crear propiedad:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/propiedades - Obtener todas las propiedades de la empresa del usuario
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

    // PUT /api/propiedades/:id - Actualizar una propiedad
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

    // DELETE /api/propiedades/:id - Eliminar una propiedad
    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarPropiedad(db, empresaId, id);
            res.status(204).send(); // 204 No Content es la respuesta estándar para un delete exitoso
        } catch (error) {
            console.error("Error al eliminar propiedad:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};