const express = require('express');
const { obtenerDetallesEmpresa } = require('../services/empresaService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const detalles = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(detalles);
        } catch (error) {
            console.error("Error al obtener detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};