// backend/routes/tarifas.js
const express = require('express');
const {
    obtenerTemporadasPorEmpresa,
    crearTemporada,
    actualizarTemporada,
    eliminarTemporada,
} = require('../services/temporadasService');
const {
    obtenerTarifasPorTemporada,
    guardarTarifasBulk,
    actualizarTarifa,
    eliminarTarifa,
    eliminarTarifasPorTemporada,
} = require('../services/tarifasService');
const { eliminarPropiedadConTarifas } = require('../services/propiedadesService');

module.exports = (db) => {
    const router = express.Router();

    // ── Temporadas ────────────────────────────────────────────────────────────

    router.get('/temporadas', async (req, res) => {
        try {
            const data = await obtenerTemporadasPorEmpresa(req.user.empresaId);
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/temporadas', async (req, res) => {
        try {
            const data = await crearTemporada(req.user.empresaId, req.body);
            res.status(201).json(data);
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    router.put('/temporadas/:id', async (req, res) => {
        try {
            const data = await actualizarTemporada(req.user.empresaId, req.params.id, req.body);
            res.json(data);
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    router.delete('/temporadas/:id', async (req, res) => {
        try {
            await eliminarTemporada(req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    // ── Tarifas (precios dentro de una temporada) ─────────────────────────────

    // GET /tarifas?temporadaId=xxx  → matriz de precios de esa temporada
    router.get('/', async (req, res) => {
        try {
            const { temporadaId } = req.query;
            if (!temporadaId) return res.status(400).json({ error: 'temporadaId requerido' });
            const data = await obtenerTarifasPorTemporada(req.user.empresaId, temporadaId);
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /tarifas/bulk  → guardar/actualizar múltiples precios en una temporada
    router.post('/bulk', async (req, res) => {
        try {
            const { temporadaId, precios } = req.body;
            if (!temporadaId || !Array.isArray(precios)) {
                return res.status(400).json({ error: 'temporadaId y precios[] son requeridos' });
            }
            const ids = await guardarTarifasBulk(req.user.empresaId, temporadaId, precios);
            res.status(201).json({ saved: ids.length });
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    router.put('/:id', async (req, res) => {
        try {
            const data = await actualizarTarifa(req.user.empresaId, req.params.id, req.body.precioBase);
            res.json(data);
        } catch (e) { res.status(400).json({ error: e.message }); }
    });

    // DELETE /tarifas/propiedad/:propiedadId — elimina la propiedad + todas sus tarifas (bloquea si tiene reservas)
    router.delete('/propiedad/:propiedadId', async (req, res) => {
        try {
            await eliminarPropiedadConTarifas(db, req.user.empresaId, req.params.propiedadId);
            res.status(204).send();
        } catch (e) {
            const status = e.message.includes('reservas asociadas') ? 409 : 500;
            res.status(status).json({ error: e.message });
        }
    });

    router.delete('/por-temporada/:temporadaId', async (req, res) => {
        try {
            await eliminarTarifasPorTemporada(req.user.empresaId, req.params.temporadaId);
            res.status(204).send();
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarTarifa(req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
