/**
 * backend/routes/catalogoRoutes.js
 *
 * Rutas del catálogo universal de activos.
 * Permite buscar activos del catálogo (universal + privado de la empresa)
 * y crear nuevos activos con clasificación automática por IA.
 *
 * Todas las rutas requieren autenticación JWT (authMiddleware aplicado globalmente).
 */

const express = require('express');
const { buscarEnCatalogo, crearEnCatalogo, registrarUso, obtenerSugerenciasPorCategoria } = require('../services/catalogoService');
const { analizarMetadataActivo } = require('../services/aiContentService');
const pool = require('../db/postgres');

const router = express.Router();

// GET /catalogo/activos?q=tinaja&categoria=Exterior
// Busca en el catálogo universal + privado de la empresa
// Combina búsqueda por nombre y por seo_tags
router.get('/activos', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const { q = '' } = req.query;
        const resultados = await buscarEnCatalogo(empresaId, q, 10);
        res.json(resultados);
    } catch (error) { next(error); }
});

// GET /catalogo/activos/sugerencias?categoria=Dormitorio
// Devuelve los activos universales más usados para una categoría dada
router.get('/activos/sugerencias', async (req, res, next) => {
    try {
        const { categoria = 'Otros' } = req.query;
        const sugerencias = await obtenerSugerenciasPorCategoria(categoria, 8);
        res.json(sugerencias);
    } catch (error) { next(error); }
});

// POST /catalogo/activos
// Crea un activo nuevo en el catálogo privado de la empresa.
// La IA lo clasifica automáticamente (schema_type, seo_tags, etc.).
router.post('/activos', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const { nombre } = req.body;

        if (!nombre?.trim()) {
            return res.status(400).json({ error: 'Falta el nombre del activo.' });
        }
        if (nombre.trim().length > 100) {
            return res.status(400).json({ error: 'El nombre del activo no puede superar 100 caracteres.' });
        }

        // Obtener categorías existentes en el catálogo de esta empresa (para que la IA las reutilice)
        let categoriasBase = ['Dormitorio', 'Baño', 'Cocina', 'Sala', 'Exterior', 'Entretenimiento', 'Otros'];
        if (pool) {
            const { rows } = await pool.query(
                `SELECT DISTINCT categoria FROM activos_catalogo
                 WHERE empresa_id IS NULL OR empresa_id = $1
                 ORDER BY categoria`,
                [empresaId]
            );
            if (rows.length > 0) {
                categoriasBase = rows.map(r => r.categoria);
            }
        }

        // Clasificar con IA
        const aiResult = await analizarMetadataActivo(nombre.trim(), categoriasBase);

        // Persistir en catálogo privado de la empresa
        const activo = await crearEnCatalogo(empresaId, {
            nombre: aiResult.normalized_name || nombre.trim(),
            categoria: aiResult.category || 'Otros',
            icono: aiResult.icon || '🔹',
            capacity: aiResult.capacity || 0,
            countable: aiResult.countable ?? true,
            requiresPhoto: aiResult.requires_photo ?? false,
            photoQuantity: aiResult.photo_quantity || 0,
            photoGuidelines: aiResult.photo_guidelines || null,
            seoTags: aiResult.seo_tags || [],
            salesContext: aiResult.sales_context || null,
            schemaType: aiResult.schema_type || 'LocationFeatureSpecification',
            schemaProperty: aiResult.schema_property || null,
        });

        res.status(201).json(activo);
    } catch (error) { next(error); }
});

// POST /catalogo/activos/:id/uso
// Registra que la empresa adoptó un activo universal (incrementa uso_count)
router.post('/activos/:id/uso', async (req, res, next) => {
    try {
        await registrarUso(req.params.id);
        res.json({ ok: true });
    } catch (error) { next(error); }
});

module.exports = router;
