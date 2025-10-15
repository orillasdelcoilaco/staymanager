// backend/routes/crm.js
const express = require('express');
const { obtenerClientesPorSegmento } = require('../services/crmService');
const { recalcularEstadisticasClientes } = require('../services/clientesService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/recalcular-segmentos', async (req, res) => {
        try {
            const { empresaId } = req.user;
            await recalcularEstadisticasClientes(db, empresaId);
            res.status(200).json({ message: 'La segmentación de clientes ha sido actualizada.' });
        } catch (error) {
            console.error("Error al recalcular segmentos:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/segmento/:segmento', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { segmento } = req.params;
            const clientes = await obtenerClientesPorSegmento(db, empresaId, segmento);
            res.status(200).json(clientes);
        } catch (error) {
            console.error(`Error al obtener clientes del segmento ${req.params.segmento}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};