const express = require('express');
const multer = require('multer');
const path = require('path');
const { getReservasPendientes, actualizarEstadoGrupo, getNotas, addNota, getTransacciones, getAnalisisFinanciero } = require('../services/gestionService');
const { uploadFile } = require('../services/storageService');
const { actualizarValoresGrupo, calcularPotencialGrupo, registrarPago, eliminarPago, actualizarDocumentoReserva } = require('../services/reservasService');

// ... (El resto del archivo no cambia)

module.exports = (db) => {
    const router = express.Router();
    
    // ... (rutas existentes no cambian)

    // --- INICIO DE LA NUEVA RUTA ---
    router.post('/analisis', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const grupoReserva = req.body;
            const analisis = await getAnalisisFinanciero(db, empresaId, grupoReserva);
            res.status(200).json(analisis);
        } catch (error) {
            console.error("Error al generar análisis financiero:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });
    // --- FIN DE LA NUEVA RUTA ---
    
    return router;
};