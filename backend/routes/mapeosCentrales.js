// backend/routes/mapeosCentrales.js
//
// Rutas para gestión de mapeos OTA centralizados (sistema admin).
// Accesible por cualquier usuario autenticado para lectura.
// Escritura y sync: protegido por SYSTEM_ADMIN_EMAIL en .env

const express = require('express');
const {
    obtenerTodosMapeosCentrales,
    obtenerMapeoCentral,
    guardarMapeoCentral,
    aplicarMapeoCentralAEmpresa,
    sincronizarMapeosEnTodasEmpresas,
    exportarMapeosDeEmpresa
} = require('../services/mapeosCentralesService');

const isSystemAdmin = (req) => {
    const adminEmails = (process.env.SYSTEM_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    return adminEmails.length === 0 || adminEmails.includes(req.user.email);
};

module.exports = (db) => {
    const router = express.Router();

    // GET - listar todos los mapeos centrales (cualquier usuario autenticado)
    router.get('/', async (req, res) => {
        try {
            const mapeos = await obtenerTodosMapeosCentrales(db);
            res.json(mapeos);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET - obtener uno por key
    router.get('/:otaKey', async (req, res) => {
        try {
            const mapeo = await obtenerMapeoCentral(db, req.params.otaKey);
            if (!mapeo) return res.status(404).json({ error: 'Mapeo central no encontrado' });
            res.json(mapeo);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT - crear/actualizar un mapeo central (solo admin del sistema)
    router.put('/:otaKey', async (req, res) => {
        if (!isSystemAdmin(req)) return res.status(403).json({ error: 'Acción restringida al administrador del sistema.' });
        try {
            const datos = await guardarMapeoCentral(db, req.params.otaKey, req.body);
            res.json(datos);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST - exportar mapeo de la empresa actual al central (solo admin del sistema)
    router.post('/exportar', async (req, res) => {
        if (!isSystemAdmin(req)) return res.status(403).json({ error: 'Acción restringida al administrador del sistema.' });
        try {
            const { canalId } = req.body;
            if (!canalId) return res.status(400).json({ error: 'canalId requerido' });
            const datos = await exportarMapeosDeEmpresa(db, req.user.empresaId, canalId);
            const otaKey = datos.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const saved = await guardarMapeoCentral(db, otaKey, datos);
            res.json({ otaKey, ...saved });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST - sincronizar un mapeo central a TODAS las empresas (solo admin del sistema)
    router.post('/:otaKey/sync', async (req, res) => {
        if (!isSystemAdmin(req)) return res.status(403).json({ error: 'Acción restringida al administrador del sistema.' });
        try {
            const result = await sincronizarMapeosEnTodasEmpresas(db, req.params.otaKey);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST - aplicar un mapeo central a la empresa actual (cualquier usuario autenticado)
    router.post('/:otaKey/aplicar', async (req, res) => {
        try {
            const { canalId } = req.body;
            if (!canalId) return res.status(400).json({ error: 'canalId requerido' });
            const datos = await obtenerMapeoCentral(db, req.params.otaKey);
            if (!datos) return res.status(404).json({ error: 'Mapeo central no encontrado' });
            await aplicarMapeoCentralAEmpresa(db, req.user.empresaId, canalId, datos);
            res.json({ ok: true, mensaje: `Mapeo de "${datos.nombre}" aplicado al canal.` });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
