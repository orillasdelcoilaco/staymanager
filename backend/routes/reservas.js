const express = require('express');
const {
    obtenerReservasPorEmpresa,
    obtenerReservaPorId, // <-- AÑADIDO
    actualizarReservaManualmente,
    eliminarReserva
} = require('../services/reservasService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const reservas = await obtenerReservasPorEmpresa(db, req.user.empresaId);
            res.status(200).json(reservas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // --- NUEVO ENDPOINT ---
    router.get('/:id', async (req, res) => {
        try {
            const reserva = await obtenerReservaPorId(db, req.user.empresaId, req.params.id);
            res.status(200).json(reserva);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    // --- FIN ---

    router.put('/:id', async (req, res) => {
        try {
            const reservaActualizada = await actualizarReservaManualmente(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(reservaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarReserva(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};