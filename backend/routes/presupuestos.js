const express = require('express');
const { generarTextoPresupuesto } = require('../services/presupuestosService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/generar-texto', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { cliente, fechaLlegada, fechaSalida, propiedades } = req.body;
            
            if (!cliente || !fechaLlegada || !fechaSalida || !propiedades) {
                return res.status(400).json({ error: 'Faltan datos para generar el presupuesto.' });
            }

            const texto = await generarTextoPresupuesto(db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades);
            res.status(200).json({ texto });
        } catch (error) {
            console.error("Error al generar texto de presupuesto:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};