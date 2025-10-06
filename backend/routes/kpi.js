// backend/routes/kpi.js
const express = require('express');
const { calculateKPIs } = require('../services/kpiService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { fechaInicio, fechaFin, canal } = req.query;

            if (!fechaInicio || !fechaFin) {
                return res.status(400).json({ error: 'Se requieren las fechas de inicio y fin.' });
            }

            const kpis = await calculateKPIs(db, empresaId, fechaInicio, fechaFin, canal || null);
            res.status(200).json(kpis);
        } catch (error) {
            console.error("Error en la ruta de KPIs:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};