const express = require('express');
const { obtenerHistorialPorEmpresa } = require('../services/historialCargasService');
const { eliminarReservasPorIdCarga } = require('../services/reservasService'); 

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const historial = await obtenerHistorialPorEmpresa(db, empresaId);
            res.status(200).json(historial);
        } catch (error) {
            console.error("Error al obtener el historial de cargas:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:idCarga', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idCarga } = req.params;
            const resultado = await eliminarReservasPorIdCarga(db, empresaId, idCarga);
            res.status(200).json({
                message: `Proceso finalizado. Se eliminaron ${resultado.eliminadas} reserva(s) asociadas a la carga.`,
                summary: resultado
            });
        } catch (error) {
            console.error(`Error al eliminar reservas por carga ${req.params.idCarga}:`, error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    return router;
};