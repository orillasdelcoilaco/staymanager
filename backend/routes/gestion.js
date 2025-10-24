// backend/routes/gestion.js
const express = require('express');
const admin = require('firebase-admin');
const { getPendingTasks, getTaskCounts } = require('../services/gestionService');
const { addTransaccion, deleteTransaccion } = require('../services/transaccionesService');
const { addDocumento, deleteDocumento } = require('../services/documentosService');
const { getAnalisisFinanciero, updateAnalisisFinanciero } = require('../services/analisisFinancieroService');

module.exports = (db) => {
    const router = express.Router();

    // Obtener tareas pendientes (sin cambios)
    router.get('/pendientes', async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const tasks = await getPendingTasks(db, empresaId);
            res.status(200).json(tasks);
        } catch (error) {
            console.error('Error al obtener tareas pendientes:', error);
            res.status(500).send('Error al obtener tareas pendientes: ' + error.message);
        }
    });

    // Obtener conteo de tareas (sin cambios)
    router.get('/conteo-tareas', async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const counts = await getTaskCounts(db, empresaId);
            res.status(200).json(counts);
        } catch (error) {
            console.error('Error al obtener conteo de tareas:', error);
            res.status(500).send('Error al obtener conteo de tareas: ' + error.message);
        }
    });

    // Actualizar ESTADO DE GESTIÓN (sin cambios)
    router.post('/actualizar-estado', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId, nuevoEstado } = req.body;
            if (!reservaId || !nuevoEstado) {
                return res.status(400).send('Faltan reservaId o nuevoEstado.');
            }

            const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
            await reservaRef.update({ estadoGestion: nuevoEstado });

            res.status(200).json({ message: 'Estado de gestión actualizado con éxito.' });
        } catch (error) {
            console.error('Error al actualizar estado de gestión:', error);
            res.status(500).send('Error al actualizar estado de gestión: ' + error.message);
        }
    });

    // --- INICIO: NUEVO ENDPOINT PARA ESTADO DE RESERVA ---
    /**
     * Actualiza el 'estado' principal de una reserva (Confirmada, Cancelada, etc.)
     * Esto es diferente del 'estadoGestion' (operativo).
     */
    router.post('/actualizar-estado-reserva', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId, nuevoEstadoReserva } = req.body;
            
            if (!reservaId || !nuevoEstadoReserva) {
                return res.status(400).send('Faltan reservaId o nuevoEstadoReserva.');
            }

            console.log(`[Gestión] Actualizando ESTADO RESERVA para ${reservaId} a: ${nuevoEstadoReserva}`);

            const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
            
            // Actualizar solo el campo 'estado'
            await reservaRef.update({ 
                estado: nuevoEstadoReserva 
            });

            res.status(200).json({ message: 'Estado de reserva actualizado con éxito.' });
        } catch (error) {
            console.error('Error al actualizar estado de reserva:', error);
            res.status(500).send('Error al actualizar estado de reserva: ' + error.message);
        }
    });
    // --- FIN: NUEVO ENDPOINT PARA ESTADO DE RESERVA ---


    // Actualizar nota (sin cambios)
    router.post('/actualizar-nota', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId, nota } = req.body;
            if (!reservaId) {
                return res.status(400).send('Falta reservaId.');
            }

            const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
            await reservaRef.update({ notaInterna: nota || null });

            res.status(200).json({ message: 'Nota actualizada con éxito.' });
        } catch (error) {
            console.error('Error al actualizar nota:', error);
            res.status(500).send('Error al actualizar nota: ' + error.message);
        }
    });

    // Añadir transacción (sin cambios)
    router.post('/transacciones', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const transaccion = await addTransaccion(db, empresaId, req.body);
            res.status(201).json(transaccion);
        } catch (error) {
            console.error('Error al añadir transacción:', error);
            res.status(500).send('Error al añadir transacción: ' + error.message);
        }
    });

    // Eliminar transacción (sin cambios)
    router.delete('/transacciones/:reservaId/:transaccionId', async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId, transaccionId } = req.params;
            await deleteTransaccion(db, empresaId, reservaId, transaccionId);
            res.status(200).json({ message: 'Transacción eliminada con éxito' });
        } catch (error) {
            console.error('Error al eliminar transacción:', error);
            res.status(500).send('Error al eliminar transacción: ' + error.message);
        }
    });

    // Añadir documento (sin cambios)
    router.post('/documentos', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const documento = await addDocumento(db, empresaId, req.body);
            res.status(201).json(documento);
        } catch (error) {
            console.error('Error al añadir documento:', error);
            res.status(500).send('Error al añadir documento: ' + error.message);
        }
    });

    // Eliminar documento (sin cambios)
    router.delete('/documentos/:reservaId/:documentoId', async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId, documentoId } = req.params;
            await deleteDocumento(db, empresaId, reservaId, documentoId);
            res.status(200).json({ message: 'Documento eliminado con éxito' });
        } catch (error) {
            console.error('Error al eliminar documento:', error);
            res.status(500).send('Error al eliminar documento: ' + error.message);
        }
    });

    // Obtener análisis financiero (sin cambios)
    router.get('/analisis-financiero/:reservaId', async (req, res) => {
         try {
            const empresaId = req.user.empresaId;
            const { reservaId } = req.params;
            const data = await getAnalisisFinanciero(db, empresaId, reservaId);
            res.status(200).json(data);
        } catch (error) {
            console.error('Error al obtener análisis financiero:', error);
            res.status(500).send('Error al obtener análisis financiero: ' + error.message);
        }
    });

    // Actualizar análisis financiero (sin cambios)
    router.post('/analisis-financiero/:reservaId', express.json(), async (req, res) => {
        try {
            const empresaId = req.user.empresaId;
            const { reservaId } = req.params;
            const data = req.body;
            await updateAnalisisFinanciero(db, empresaId, reservaId, data);
            res.status(200).json({ message: 'Análisis financiero actualizado con éxito.' });
        } catch (error) {
            console.error('Error al actualizar análisis financiero:', error);
            res.status(500).send('Error al actualizar análisis financiero: ' + error.message);
        }
    });

    return router;
};