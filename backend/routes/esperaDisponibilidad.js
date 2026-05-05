const express = require('express');
const {
    obtenerEstadosEsperaPorEmpresa,
    crearEstadoEspera,
    actualizarEstadoEspera,
    eliminarEstadoEspera,
    crearEsperaDisponibilidad,
    listarEsperaDisponibilidad,
    actualizarEstadoEsperaRegistro,
    reconciliarEsperaDisponibilidad,
} = require('../services/esperaDisponibilidadService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/estados', async (req, res) => {
        try {
            const estados = await obtenerEstadosEsperaPorEmpresa(req.user.empresaId);
            res.status(200).json(estados);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/estados', async (req, res) => {
        try {
            const estado = await crearEstadoEspera(req.user.empresaId, req.body || {});
            res.status(201).json(estado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/estados/:id', async (req, res) => {
        try {
            const estado = await actualizarEstadoEspera(req.user.empresaId, req.params.id, req.body || {});
            res.status(200).json(estado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/estados/:id', async (req, res) => {
        try {
            await eliminarEstadoEspera(req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const listado = await listarEsperaDisponibilidad(req.user.empresaId);
            res.status(200).json(listado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const created = await crearEsperaDisponibilidad(db, req.user.empresaId, req.body || {});
            res.status(201).json(created);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id/estado', async (req, res) => {
        try {
            const estadoId = String(req.body?.estadoId || '').trim();
            if (!estadoId) {
                return res.status(400).json({ error: 'estadoId es obligatorio.' });
            }
            await actualizarEstadoEsperaRegistro(req.user.empresaId, req.params.id, estadoId);
            res.status(200).json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/reconciliar', async (req, res) => {
        try {
            const stats = await reconciliarEsperaDisponibilidad(db, req.user.empresaId);
            res.status(200).json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
