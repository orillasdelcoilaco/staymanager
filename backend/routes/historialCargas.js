const express = require('express');
const { obtenerHistorialPorEmpresa } = require('../services/historialCargasService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const historial = await obtenerHistorialPorEmpresa(db, empresaId);
            res.status(200).json(historial);
        } catch (error) {
            console.error("Error al obtener el historial de cargas:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};