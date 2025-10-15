// backend/routes/crm.js
const express = require('express');
const { obtenerClientesPorSegmento, segmentarClienteRFM } = require('../services/crmService');
const { recalcularEstadisticasClientes } = require('../services/clientesService');
const { crearCampanaYRegistrarInteracciones, actualizarEstadoInteraccion, obtenerCampanas } = require('../services/campanasService');
const { generarCuponParaCliente, validarCupon } = require('../services/cuponesService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/recalcular-segmentos', async (req, res) => {
        try {
            const { empresaId } = req.user;
            await recalcularEstadisticasClientes(db, empresaId);
            res.status(200).json({ message: 'La segmentación de clientes ha sido actualizada.' });
        } catch (error) {
            console.error("Error al recalcular segmentos:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/segmento/:segmento', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { segmento } = req.params;
            const clientes = await obtenerClientesPorSegmento(db, empresaId, segmento);
            res.status(200).json(clientes);
        } catch (error) {
            console.error(`Error al obtener clientes del segmento ${req.params.segmento}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/campanas', async (req, res) => {
        try {
            const { empresaId, email } = req.user;
            const datosCampana = { ...req.body, autor: email };
            const nuevaCampana = await crearCampanaYRegistrarInteracciones(db, empresaId, datosCampana);
            res.status(201).json(nuevaCampana);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/campanas', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const campanas = await obtenerCampanas(db, empresaId);
            res.status(200).json(campanas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/campanas/:campanaId/interacciones', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { campanaId } = req.params;
            const snapshot = await db.collection('empresas').doc(empresaId).collection('interacciones')
                .where('campanaId', '==', campanaId).get();
            const interacciones = snapshot.docs.map(doc => doc.data());
            res.status(200).json(interacciones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/interacciones/:interaccionId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { interaccionId } = req.params;
            const { estado } = req.body;
            await actualizarEstadoInteraccion(db, empresaId, interaccionId, estado);
            res.status(200).json({ message: 'Estado actualizado.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/cupones', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { clienteId, porcentajeDescuento } = req.body;
            const nuevoCupon = await generarCuponParaCliente(db, empresaId, clienteId, porcentajeDescuento);
            res.status(201).json(nuevoCupon);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.get('/cupones/validar/:codigo', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { codigo } = req.params;
            const cupon = await validarCupon(db, empresaId, codigo);
            res.status(200).json(cupon);
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    return router;
};