/**
 * galeriaRoutes.js
 *
 * REST API para gestión de la galería de fotos por propiedad.
 * Requiere authMiddleware (req.user.empresaId disponible).
 *
 *   GET    /api/galeria/:propiedadId            — listar fotos (filtros: ?estado=&espacio=)
 *   PATCH  /api/galeria/:propiedadId/:fotoId    — editar espacio / estado / rol
 *   POST   /api/galeria/:propiedadId/:fotoId/confirmar  — pendiente → auto
 *   DELETE /api/galeria/:propiedadId/:fotoId    — descartar foto (soft delete)
 *   POST   /api/galeria/:propiedadId/sync       — sincronizar confirmadas → websiteData.images
 *   POST   /api/galeria/:propiedadId/upload     — subir foto directamente a la galería (pendiente)
 */

const express = require('express');
const multer = require('multer');
const { getGaleria, updateFoto, descartarFoto, confirmarFoto, syncToWebsite, uploadFotoToGaleria } = require('../services/galeriaService');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (db) => {
    const router = express.Router();

    // ── Listar fotos de la galería ──────────────────────────────────────────
    router.get('/:propiedadId', async (req, res) => {
        const { propiedadId } = req.params;
        const { empresaId } = req.user;
        const { estado, espacio } = req.query;
        try {
            const fotos = await getGaleria(db, empresaId, propiedadId, { estado, espacio });
            res.json(fotos);
        } catch (err) {
            console.error('[GaleriaRoute] GET error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Actualizar foto (espacio, estado, rol, orden, altText) ──────────────
    router.patch('/:propiedadId/:fotoId', async (req, res) => {
        const { propiedadId, fotoId } = req.params;
        const { empresaId } = req.user;
        try {
            await updateFoto(db, empresaId, propiedadId, fotoId, req.body);
            res.json({ ok: true });
        } catch (err) {
            console.error('[GaleriaRoute] PATCH error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Confirmar foto pendiente ─────────────────────────────────────────────
    router.post('/:propiedadId/:fotoId/confirmar', async (req, res) => {
        const { propiedadId, fotoId } = req.params;
        const { empresaId } = req.user;
        try {
            await confirmarFoto(db, empresaId, propiedadId, fotoId);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Descartar foto ──────────────────────────────────────────────────────
    router.delete('/:propiedadId/:fotoId', async (req, res) => {
        const { propiedadId, fotoId } = req.params;
        const { empresaId } = req.user;
        try {
            await descartarFoto(db, empresaId, propiedadId, fotoId);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Sincronizar galería confirmada → websiteData.images ─────────────────
    router.post('/:propiedadId/sync', async (req, res) => {
        const { propiedadId } = req.params;
        const { empresaId } = req.user;
        try {
            const result = await syncToWebsite(db, empresaId, propiedadId);
            res.json(result);
        } catch (err) {
            console.error('[GaleriaRoute] SYNC error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Subir foto a la galería (estado: pendiente) ──────────────────────────
    router.post('/:propiedadId/upload', upload.array('images'), async (req, res) => {
        const { propiedadId } = req.params;
        const { empresaId, nombreEmpresa } = req.user;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No se recibieron archivos.' });
        }
        try {
            const fotos = await uploadFotoToGaleria(db, empresaId, propiedadId, req.files, nombreEmpresa);
            res.status(201).json(fotos);
        } catch (err) {
            console.error('[GaleriaRoute] UPLOAD error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
