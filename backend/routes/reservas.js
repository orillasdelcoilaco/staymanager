// backend/routes/reservas.js

const express = require('express');
const multer = require('multer');
const {
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    actualizarReservaManualmente,
    decidirYEliminarReserva,
    eliminarGrupoReservasCascada
} = require('../services/reservasService');
const { gestionarDocumentoReserva } = require('../services/documentosService');
const { actualizarIdReservaCanalEnCascada } = require('../services/utils/cascadingUpdateService');

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
            const reserva = await obtenerReservaPorId(db, req.user.empresaId, req.params.id);
            res.status(200).json(reserva);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const reservaActualizada = await actualizarReservaManualmente(db, req.user.empresaId, req.user.email, req.params.id, req.body);
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
            const resultado = await decidirYEliminarReserva(db, req.user.empresaId, req.params.id);
            res.status(200).json(resultado);
        } catch (error) {
            if (error.code === 409) {
                res.status(409).json({ error: error.message, data: error.data });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });

    router.post('/grupo/eliminar', async (req, res) => {
        try {
            const { idReservaCanal } = req.body;
            if (!idReservaCanal) {
                return res.status(400).json({ error: 'Se requiere idReservaCanal.' });
            }
            const resultado = await eliminarGrupoReservasCascada(db, req.user.empresaId, idReservaCanal);
            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};