const express = require('express');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');

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

    router.put('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datosActualizados = req.body;
            await actualizarDetallesEmpresa(db, empresaId, datosActualizados);
            res.status(200).json({ message: 'Datos de la empresa actualizados con éxito.' });
        } catch (error) {
            console.error("Error al actualizar detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};