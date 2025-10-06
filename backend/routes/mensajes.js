// backend/routes/mensajes.js

const express = require('express');
const { prepararMensaje, generarTextoPropuesta, generarTextoReporte } = require('../services/mensajeService');
const { getReservasPendientes } = require('../services/gestionService'); 

module.exports = (db) => {
    const router = express.Router();

    router.post('/preparar', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { reservaIdOriginal, tipoMensaje } = req.body;

            const { grupos: todosLosGrupos } = await getReservasPendientes(db, empresaId);
            const grupoReserva = todosLosGrupos.find(g => g.reservaIdOriginal === reservaIdOriginal);
            
            if (!grupoReserva) {
                return res.status(404).json({ error: 'Grupo de reserva no encontrado.' });
            }

            const data = await prepararMensaje(db, empresaId, grupoReserva, tipoMensaje);
            res.status(200).json(data);
        } catch (error) {
            console.error("Error al preparar el mensaje:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/preparar-reporte', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { tipoReporte, datos } = req.body;
            const texto = await generarTextoReporte(db, empresaId, tipoReporte, datos);
            res.status(200).json({ texto });
        } catch (error) {
            console.error("Error al preparar el reporte:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};