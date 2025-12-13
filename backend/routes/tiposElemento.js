const express = require('express');
const tiposElementoService = require('../services/tiposElementoService');
const aiContentService = require('../services/aiContentService');

module.exports = (db) => {
    const router = express.Router();

    // GET /tipos-elemento
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const tipos = await tiposElementoService.obtenerTipos(db, empresaId);
            res.json(tipos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /tipos-elemento
    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datos = req.body;

            if (!datos.nombre) {
                return res.status(400).json({ error: 'El nombre es obligatorio.' });
            }

            // LÓGICA AUTO-CAPACIDAD + CATEGORIZACIÓN EVOLUTIVA (IA)
            // Si falta capacidad O categoría, activamos el cerebro
            if (!datos.categoria || (!datos.capacity && datos.capacity !== 0)) {
                try {
                    // 1. Obtener contexto (Categorías existentes)
                    const tiposExistentes = await tiposElementoService.obtenerTipos(db, empresaId);
                    const categoriasUnicas = [...new Set(tiposExistentes.map(t => t.categoria).filter(Boolean))];

                    console.log(`🤖 Analizando activo "${datos.nombre}" con contexto:`, categoriasUnicas);

                    const aiResult = await aiContentService.analizarMetadataActivo(datos.nombre, categoriasUnicas);

                    if (aiResult) {
                        // CHECK: Low Confidence
                        // Si la IA duda y no hay flag de "force_creation", pedimos confirmación.
                        if (aiResult.confidence === 'low' && !datos.force_creation) {
                            return res.status(422).json({
                                message: `Ambiguity Detected for "${datos.nombre}"`,
                                ai_result: aiResult,
                                action_required: 'manual_classification'
                            });
                        }

                        // Auto-fill
                        if (!datos.capacity) datos.capacity = aiResult.capacity;
                        if (!datos.categoria) datos.categoria = aiResult.category;
                        if (!datos.icono) datos.icono = aiResult.icon;
                        if (datos.countable === undefined) datos.countable = aiResult.countable;

                        // New Metadata (SEO & Photos)
                        if (datos.requires_photo === undefined) datos.requires_photo = aiResult.requires_photo;
                        if (datos.photo_quantity === undefined) datos.photo_quantity = aiResult.photo_quantity;
                        if (!datos.seo_tags) datos.seo_tags = aiResult.seo_tags;

                        // AI Context & Normalization
                        if (aiResult.normalized_name) datos.nombre = aiResult.normalized_name; // Auto-correction
                        if (!datos.sales_context) datos.sales_context = aiResult.sales_context;
                        if (!datos.photo_guidelines) datos.photo_guidelines = aiResult.photo_guidelines;

                        datos.ai_autofilled = true;
                    }
                } catch (error) {
                    console.error("⚠️ Error consultando servicio AI:", error.message);
                }
            }

            // Validación final
            if (!datos.categoria) {
                datos.categoria = 'OTROS'; // Fallback final
            }

            const nuevoTipo = await tiposElementoService.crearTipo(db, empresaId, datos);
            res.status(201).json(nuevoTipo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /tipos-elemento/:id
    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await tiposElementoService.eliminarTipo(db, empresaId, id);
            res.json({ message: 'Tipo de elemento eliminado correctamente.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // PUT /tipos-elemento/:id
    router.put('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            const datos = req.body;

            const documentoActualizado = await tiposElementoService.actualizarTipo(db, empresaId, id, datos);
            res.json(documentoActualizado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
