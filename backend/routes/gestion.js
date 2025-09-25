const express = require('express');
const multer = require('multer');
const path = require('path');
const { getReservasPendientes, actualizarEstadoGrupo, getNotas, addNota, getTransacciones } = require('../services/gestionService');
const { uploadFile } = require('../services/storageService');
const { actualizarValoresGrupo, calcularPotencialGrupo, registrarPago, actualizarDocumentoReserva } = require('../services/reservasService');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (db) => {
    const router = express.Router();

    router.get('/pendientes', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const reservasPendientes = await getReservasPendientes(db, empresaId);
            res.status(200).json(reservasPendientes);
        } catch (error) {
            console.error("Error al obtener reservas pendientes:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    router.post('/actualizar-estado', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idsIndividuales, nuevoEstado } = req.body;
            await actualizarEstadoGrupo(db, empresaId, idsIndividuales, nuevoEstado);
            res.status(200).json({ message: 'Estado actualizado correctamente.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/notas/:reservaIdOriginal', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { reservaIdOriginal } = req.params;
            const notas = await getNotas(db, empresaId, reservaIdOriginal);
            res.status(200).json(notas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/notas', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const nuevaNota = await addNota(db, empresaId, req.body);
            res.status(201).json(nuevaNota);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    router.post('/transacciones', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idsIndividuales } = req.body;
            const transacciones = await getTransacciones(db, empresaId, idsIndividuales);
            res.status(200).json(transacciones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/ajustar-valores', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { valoresCabanas } = req.body;
            await actualizarValoresGrupo(db, empresaId, valoresCabanas);
            res.status(200).json({ message: 'Valores actualizados.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/calcular-potencial', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idsIndividuales, descuento } = req.body;
            await calcularPotencialGrupo(db, empresaId, idsIndividuales, descuento);
            res.status(200).json({ message: 'Valor potencial calculado.' });
        } catch(error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/registrar-pago', upload.single('documento'), async (req, res) => {
        try {
            const { empresaId } = req.user;
            const detalles = JSON.parse(req.body.detalles);
            let publicUrl = null;

            if (detalles.sinDocumento) {
                publicUrl = 'SIN_DOCUMENTO';
            } else if (req.file) {
                const year = new Date().getFullYear();
                const fileName = `${detalles.reservaIdOriginal}_pago_${Date.now()}${path.extname(req.file.originalname)}`;
                const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
                publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);
            }
            detalles.enlaceComprobante = publicUrl;
            
            await registrarPago(db, empresaId, detalles);
            res.status(200).json({ message: 'Pago registrado con éxito.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    router.post('/actualizar-documento', upload.single('documento'), async (req, res) => {
        try {
            const { empresaId } = req.user;
            const detalles = JSON.parse(req.body.detalles);
            let publicUrl = null;

            if (req.file) {
                const year = new Date().getFullYear();
                const fileName = `${detalles.reservaIdOriginal}_${detalles.tipoDocumento}_${Date.now()}${path.extname(req.file.originalname)}`;
                const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
                publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);
            }
            
            await actualizarDocumentoReserva(db, empresaId, detalles.idsIndividuales, detalles.tipoDocumento, publicUrl);
             if (detalles.avanzarEstado) {
                await actualizarEstadoGrupo(db, empresaId, detalles.idsIndividuales, detalles.avanzarEstado);
            }
            res.status(200).json({ message: `Documento '${detalles.tipoDocumento}' actualizado.` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};