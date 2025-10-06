// backend/routes/reportes.js

const express = require('express');
const { getActividadDiaria, getDisponibilidadPeriodo } = require('../services/reportesService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/actividad-diaria', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { fecha } = req.body;
            if (!fecha) {
                return res.status(400).json({ error: 'Se requiere una fecha.' });
            }
            const data = await getActividadDiaria(db, empresaId, fecha);
            res.status(200).json(data);
        } catch (error) {
            console.error("Error al generar reporte de actividad:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    router.post('/disponibilidad', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { fechaInicio, fechaFin } = req.body;
            if (!fechaInicio || !fechaFin) {
                return res.status(400).json({ error: 'Se requieren ambas fechas.' });
            }
            const data = await getDisponibilidadPeriodo(db, empresaId, fechaInicio, fechaFin);
            res.status(200).json(data);
        } catch (error) {
            console.error("Error al generar reporte de disponibilidad:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    return router;
};