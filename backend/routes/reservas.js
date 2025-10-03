// backend/routes/reservas.js

const express = require('express');
const multer = require('multer');
const {
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    eliminarReserva,
    gestionarDocumentoReserva,
    actualizarIdReservaCanalEnCascada
} = require('../services/reservasService');

const upload = multer({ storage: multer.memoryStorage() });

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

    router.get('/:id', async (req, res) => {
        try {
            // --- INICIO DE LA CORRECCIÓN ---
            // Se corrige la llamada a la función incorrecta.
            const reserva = await obtenerReservaPorId(db, req.user.empresaId, req.params.id);
            // --- FIN DE LA CORRECCIÓN ---
            res.status(200).json(reserva);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const reservaActualizada = await actualizarReservaManualmente(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(reservaActualizada);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/actualizar-id-canal/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const { idAntiguo, idNuevo } = req.body;
            const summary = await actualizarIdReservaCanalEnCascada(db, empresaId, id, idAntiguo, idNuevo);
            res.status(200).json({ 
                message: 'El ID de la reserva se ha actualizado en cascada correctamente.',
                summary: summary
            });
        } catch (error) {
            console.error("Error en la ruta de actualización de ID en cascada:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/:id/documento', upload.single('documento'), async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const { tipoDocumento, accion } = req.body;
            const archivo = req.file;

            const reservaActualizada = await gestionarDocumentoReserva(db, empresaId, id, tipoDocumento, archivo, accion);
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