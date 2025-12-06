/**
 * @fileoverview Public Gallery API for Concierge
 * Serves optimized photos for the chat interface.
 */

const express = require('express');
const { searchProperties } = require('../../services/ai/filters');

module.exports = (db) => {
    const router = express.Router();

    // GET /api/concierge/photos
    // Query params: empresaId, tag (optional), limit
    router.get('/photos', async (req, res) => {
        try {
            const empresaId = req.query.empresaId || req.headers['x-empresa-id'];
            if (!empresaId) return res.status(400).json({ error: 'Falta empresaId' });

            // Reuse search logic to get properties and their photos
            // Ideally, we'd have a specific "getPhotos" but searchProperties gets the job done for now.
            const properties = await searchProperties(db, empresaId, {});

            // Flatten all photos
            let allPhotos = [];
            properties.forEach(p => {
                if (p.fotos && Array.isArray(p.fotos)) {
                    allPhotos.push(...p.fotos.map(url => ({
                        url,
                        title: p.nombre,
                        id: p.id // property id
                    })));
                }
            });

            // Limit result
            const limit = parseInt(req.query.limit) || 10;
            const result = allPhotos.slice(0, limit);

            res.status(200).json(result);

        } catch (error) {
            console.error("Gallery API Error:", error);
            res.status(500).json({ error: "Error obteniendo fotos" });
        }
    });

    return router;
};
