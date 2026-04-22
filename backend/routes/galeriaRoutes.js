/**
 * galeriaRoutes.js
 *
 * REST API para gestión de la galería de fotos por propiedad.
 * Requiere authMiddleware (req.user.empresaId disponible).
 *
 *   GET    /api/galeria/:propiedadId            — listar fotos (filtros: ?estado=&espacio=)
 *   PATCH  /api/galeria/:propiedadId/:fotoId    — editar espacio / estado / rol
 *   POST   /api/galeria/:propiedadId/:fotoId/confirmar  — pendiente → auto
 *   DELETE /api/galeria/:propiedadId/:fotoId    — descartar/eliminar foto permanentemente
 *   POST   /api/galeria/:propiedadId/sync       — sincronizar confirmadas → websiteData.images
 *   POST   /api/galeria/:propiedadId/upload     — subir foto directamente a la galería (pendiente)
 */

const express = require('express');
const multer = require('multer');
const { getGaleria, updateFoto, descartarFoto, confirmarFoto, syncToWebsite, uploadFotoToGaleria, getCounts, setPortada, replaceFoto, getGaleriaByEspacio, uploadFotoEmpresaArea } = require('../services/galeriaService');
const { generarMetadataImagen } = require('../services/aiContentService');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = (db) => {
    const router = express.Router();

    // ── Empresa: subir foto para área común (antes de /:propiedadId) ────────
    // No escribe en galeria table (FK constraint). URLs se persisten desde frontend.
    // Genera altText + title via Gemini Vision para SEO de imágenes (no bloqueante).
    router.post('/empresa/area-foto/upload', upload.array('images'), async (req, res) => {
        const { empresaId, nombreEmpresa } = req.user;
        const { areaId, areaNombre } = req.body;
        if (!req.files?.length) return res.status(400).json({ error: 'Sin archivos.' });
        if (!areaId) return res.status(400).json({ error: 'areaId requerido.' });
        try {
            // 1. Subir al storage (optimiza a WebP)
            const fotos = await uploadFotoEmpresaArea(null, empresaId, areaId, req.files);

            // 2. Enriquecer con alt-text SEO via Gemini Vision (paralelo, no bloqueante)
            const enriched = await Promise.all(fotos.map(async (foto, i) => {
                try {
                    const meta = await generarMetadataImagen(
                        nombreEmpresa || '',
                        areaNombre || 'Instalación del recinto',
                        areaNombre || '',
                        areaNombre || 'instalación',
                        'area_comun',
                        req.files[i].buffer,
                        null  // sin auditoría de contenido esperado
                    );
                    return { ...foto, altText: meta.altText || '', title: meta.title || '' };
                } catch {
                    return foto; // si la IA falla, la foto se guarda igual sin altText
                }
            }));

            res.status(201).json(enriched);
        } catch (err) {
            console.error('[GaleriaRoute] EMPRESA UPLOAD error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Counts por propiedad (debe ir antes de /:propiedadId) ───────────────
    router.get('/counts', async (req, res) => {
        try {
            res.json(await getCounts(db, req.user.empresaId));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Fotos agrupadas por espacio con confianza (Paso 2 Contenido Web) ───
    router.get('/:propiedadId/por-espacio', async (req, res) => {
        try {
            res.json(await getGaleriaByEspacio(db, req.user.empresaId, req.params.propiedadId));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

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
            console.log(`[SYNC DEBUG] Iniciando sync para propiedad: ${propiedadId}, empresa: ${empresaId}`);
            const result = await syncToWebsite(db, empresaId, propiedadId);
            console.log(`[SYNC DEBUG] Sync completado:`, result);
            res.json(result);
        } catch (err) {
            console.error('[GaleriaRoute] SYNC error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // ── Marcar como portada ─────────────────────────────────────────────────
    router.post('/:propiedadId/:fotoId/portada', async (req, res) => {
        const { propiedadId, fotoId } = req.params;
        try {
            await setPortada(db, req.user.empresaId, propiedadId, fotoId);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Reemplazar imagen editada ────────────────────────────────────────────
    router.post('/:propiedadId/:fotoId/replace', upload.single('image'), async (req, res) => {
        const { propiedadId, fotoId } = req.params;
        if (!req.file) return res.status(400).json({ error: 'No image provided.' });
        try {
            const result = await replaceFoto(db, req.user.empresaId, propiedadId, fotoId, req.file);
            res.json(result);
        } catch (err) {
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
