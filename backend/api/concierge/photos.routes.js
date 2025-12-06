const express = require('express');
const { getMorePhotos } = require('../../services/ai/photos');

module.exports = (db) => {
    const router = express.Router();

    router.get('/more-photos', async (req, res) => {
        try {
            // Query params: alojamientoId, tipo
            const { alojamientoId, tipo, empresaId } = req.query;

            // If called from GPT, it might filter by specific company context if known,
            // otherwise we default to the header strategy or known ID.
            const empId = empresaId || req.headers['x-empresa-id'] || '7lzqGKUxuQK0c';

            if (!alojamientoId) {
                return res.status(400).json({ error: "alojamientoId required" });
            }

            const result = await getMorePhotos(db, empId, alojamientoId, tipo);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
