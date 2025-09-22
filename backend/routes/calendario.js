const express = require('express');
const { obtenerDatosCalendario } = require('../services/calendarioService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datos = await obtenerDatosCalendario(db, empresaId);
            res.status(200).json(datos);
        } catch (error) {
            console.error("Error al obtener datos del calendario:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};