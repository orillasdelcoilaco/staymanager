const express = require('express');
const { generarEstructuraAlojamiento } = require('../services/aiContentService');
const { obtenerTiposPorEmpresa } = require('../services/componentesService');

module.exports = (db) => {
    const router = express.Router();

    // POST /api/ai/generate-structure
    router.post('/generate-structure', async (req, res, next) => {
        try {
            const { descripcion } = req.body;
            const { empresaId } = req.user;

            if (!descripcion) {
                return res.status(400).json({ error: 'La descripción es obligatoria.' });
            }

            // 1. Obtener los tipos de espacios disponibles para esta empresa
            const tiposDisponibles = await obtenerTiposPorEmpresa(db, empresaId);

            // 2. Llamar a la IA para generar la estructura
            const estructura = await generarEstructuraAlojamiento(descripcion, tiposDisponibles);

            res.status(200).json(estructura);
        } catch (error) {
            console.error('Error en /generate-structure:', error);
            next(error);
        }
    });

    return router;
};
