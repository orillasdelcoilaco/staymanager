// backend/routes/historicoImporterRoutes.js
// Requiere authMiddleware (req.user.empresaId disponible)

const express = require('express');
const { previewImport, runImport } = require('../services/historicoImporterService');

module.exports = (db) => {
    const router = express.Router();

    /**
     * POST /api/historico-importer/preview
     * Analiza el JSON exportado, auto-mapea cabañas/canales, devuelve brechas.
     */
    router.post('/preview', async (req, res) => {
        const empresaId = req.user.empresaId;
        const { importData } = req.body;
        if (!importData?.reservas) return res.status(400).json({ error: 'importData inválido.' });
        try {
            const preview = await previewImport(db, empresaId, importData);
            res.json(preview);
        } catch (err) {
            console.error('[HistoricoImporter] preview error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    /**
     * POST /api/historico-importer/run
     * Ejecuta el upsert con los mapeos confirmados por el usuario.
     */
    router.post('/run', async (req, res) => {
        const empresaId = req.user.empresaId;
        const { importData, mapeoCabanas, mapeoCanales } = req.body;
        if (!importData?.reservas) return res.status(400).json({ error: 'importData inválido.' });
        if (!mapeoCabanas)         return res.status(400).json({ error: 'mapeoCabanas requerido.' });
        try {
            const meta = { nombreArchivo: req.body.nombreArchivo, usuarioEmail: req.user.email };
        const resultado = await runImport(db, empresaId, importData, mapeoCabanas, mapeoCanales || {}, meta);
            res.json(resultado);
        } catch (err) {
            console.error('[HistoricoImporter] run error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
