// backend/routes/empresa.js
const express = require('express');
// Esta debe ser la ÚNICA importación de servicio
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');

module.exports = (db) => {
    const router = express.Router();

    // Obtener los detalles de la empresa (para la vista "Gestionar Empresa")
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const detalles = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(detalles);
        } catch (error)
 {
            console.error("Error al obtener detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Actualizar los detalles de la empresa
    router.put('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datosActualizados = req.body;
            // El servicio (empresaService.js) se encarga de manejar los datos nuevos
            await actualizarDetallesEmpresa(db, empresaId, datosActualizados);
            res.status(200).json({ message: 'Datos de la empresa actualizados con éxito.' });
        } catch (error) {
            console.error("Error al actualizar detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};