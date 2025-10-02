const express = require('express');
const {
    guardarOActualizarPropuesta,
    guardarPresupuesto,
    obtenerPropuestasYPresupuestos,
    aprobarPropuesta,
    rechazarPropuesta,
    aprobarPresupuesto,
    rechazarPresupuesto
} = require('../services/gestionPropuestasService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/propuesta-tentativa', async (req, res) => {
        try {
            const resultado = await guardarOActualizarPropuesta(db, req.user.empresaId, req.body);
            res.status(201).json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/propuesta-tentativa/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const resultado = await guardarOActualizarPropuesta(db, req.user.empresaId, req.body, id);
            res.status(200).json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/presupuesto', async (req, res) => {
        try {
            const resultado = await guardarPresupuesto(db, req.user.empresaId, req.body);
            res.status(201).json(resultado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const listado = await obtenerPropuestasYPresupuestos(db, req.user.empresaId);
            res.status(200).json(listado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    router.post('/propuesta/:id/aprobar', async (req, res) => {
        try {
            const { idsReservas } = req.body;
            await aprobarPropuesta(db, req.user.empresaId, idsReservas);
            res.status(200).json({ message: 'Propuesta aprobada y convertida en reserva confirmada.' });
        } catch (error) {
            res.status(409).json({ error: error.message });
        }
    });

    router.post('/propuesta/:id/rechazar', async (req, res) => {
        try {
            const { idsReservas } = req.body;
            await rechazarPropuesta(db, req.user.empresaId, idsReservas);
            res.status(200).json({ message: 'Propuesta rechazada.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    router.post('/presupuesto/:id/aprobar', async (req, res) => {
        try {
            await aprobarPresupuesto(db, req.user.empresaId, req.params.id);
            res.status(200).json({ message: 'Presupuesto aprobado y convertido en reserva(s) confirmada(s).' });
        } catch (error) {
            res.status(409).json({ error: error.message });
        }
    });

    router.post('/presupuesto/:id/rechazar', async (req, res) => {
        try {
            await rechazarPresupuesto(db, req.user.empresaId, req.params.id);
            res.status(200).json({ message: 'Presupuesto rechazado.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};