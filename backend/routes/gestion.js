// backend/routes/gestion.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { getReservasPendientes, actualizarEstadoGrupo, getNotas, addNota, getTransacciones, marcarClienteComoGestionado } = require('../services/gestionService');
const { uploadFile } = require('../services/storageService');
const { actualizarValoresGrupo, calcularPotencialGrupo } = require('../services/analisisFinancieroService');
const { registrarPago, eliminarPago } = require('../services/transaccionesService');
const { actualizarDocumentoReserva } = require('../services/documentosService');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (db) => {
    const router = express.Router();

    router.post('/pendientes', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { lastVisible } = req.body;
            const reservasPendientes = await getReservasPendientes(db, empresaId, lastVisible);
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

    // --- INICIO: NUEVO ENDPOINT PARA ESTADO DE RESERVA ---
    /**
     * Actualiza el 'estado' principal de una reserva (Confirmada, Cancelada, etc.)
     * Esto afecta a todas las reservas de un mismo grupo (idReservaCanal).
     */
    router.post('/actualizar-estado-reserva', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { idReservaCanal, nuevoEstadoReserva } = req.body;
            
            if (!idReservaCanal || !nuevoEstadoReserva) {
                return res.status(400).send('Faltan idReservaCanal o nuevoEstadoReserva.');
            }

            console.log(`[Gestión] Actualizando ESTADO RESERVA para grupo ${idReservaCanal} a: ${nuevoEstadoReserva}`);

            const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
            const q = reservasRef.where('idReservaCanal', '==', idReservaCanal);
            const snapshot = await q.get();

            if (snapshot.empty) {
                return res.status(404).send('No se encontraron reservas para este grupo.');
            }
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { estado: nuevoEstadoReserva });
            });
            await batch.commit();

            res.status(200).json({ message: 'Estado de reserva actualizado con éxito para todo el grupo.' });
        } catch (error) {
            console.error('Error al actualizar estado de reserva:', error);
            res.status(500).send('Error al actualizar estado de reserva: ' + error.message);
        }
    });
    // --- FIN: NUEVO ENDPOINT PARA ESTADO DE RESERVA ---
    
    router.post('/marcar-cliente-gestionado', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { reservaIdOriginal } = req.body;
            await marcarClienteComoGestionado(db, empresaId, reservaIdOriginal);
            res.status(200).json({ message: 'Cliente marcado como gestionado para esta reserva.' });
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
            await addNota(db, empresaId, req.body);
            res.status(201).json({ message: 'Nota añadida.' });
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
    
    router.delete('/transaccion/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarPago(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/ajustar-valores', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { valoresCabanas, nuevoTotalHuesped } = req.body;
            await actualizarValoresGrupo(db, empresaId, valoresCabanas, nuevoTotalHuesped);
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
            res.status(200).json({ message: 'Potencial calculado y guardado correctamente.' });
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

            if (detalles.eliminarDocumento) {
                publicUrl = null;
            } else if (detalles.sinDocumento) {
                publicUrl = 'SIN_DOCUMENTO';
            } else if (req.file) {
                const year = new Date().getFullYear();
                const fileName = `${detalles.reservaIdOriginal}_${detalles.tipoDocumento}_${Date.now()}${path.extname(req.file.originalname)}`;
                const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
                publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);
            }
            
            await actualizarDocumentoReserva(db, empresaId, detalles.idsIndividuales, detalles.tipoDocumento, publicUrl);
            
            res.status(200).json({ message: `Documento '${detalles.tipoDocumento}' actualizado.` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};