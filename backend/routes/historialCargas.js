const express = require('express');
const { obtenerHistorialPorEmpresa } = require('../services/historialCargasService');
const { eliminarReservasPorIdCarga, contarReservasPorIdCarga } = require('../services/reservasService'); 

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

    router.get('/:idCarga/count', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idCarga } = req.params;
            const resultado = await contarReservasPorIdCarga(db, empresaId, idCarga);
            res.status(200).json(resultado);
        } catch (error) {
            console.error(`Error al contar reservas para la carga ${req.params.idCarga}:`, error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    router.delete('/:idCarga', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idCarga } = req.params;
            
            // Paso 1: Eliminar las reservas y sus archivos
            const resultado = await eliminarReservasPorIdCarga(db, empresaId, idCarga);

            // Paso 2: Eliminar el registro del historial de carga
            const historialDocRef = db.collection('empresas').doc(empresaId).collection('historialCargas').doc(idCarga);
            await historialDocRef.delete();

            res.status(200).json({
                message: `Proceso finalizado. Se eliminaron ${resultado.eliminadas} reserva(s) y el registro de la carga.`,
                summary: resultado
            });
        } catch (error) {
            console.error(`Error al eliminar la carga ${req.params.idCarga}:`, error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    return router;
};