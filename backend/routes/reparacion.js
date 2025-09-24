const express = require('express');
const { repararFechasSODC, repararHistorialDolar } = require('../services/reparacionService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/fechas-sodc', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const resultado = await repararFechasSODC(db, empresaId);
            res.status(200).json({
                message: 'Proceso de reparación de fechas finalizado.',
                summary: resultado
            });
        } catch (error) {
            console.error("Error en la ruta de reparación de fechas:", error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    router.post('/dolar-historico', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const resultado = await repararHistorialDolar(db, empresaId);
            res.status(200).json({
                message: 'Proceso de reparación de historial del dólar finalizado.',
                summary: resultado
            });
        } catch (error) {
            console.error("Error en la ruta de reparación del dólar:", error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    return router;
};