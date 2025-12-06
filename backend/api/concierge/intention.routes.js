const express = require('express');
const { detectIntention } = require('../../services/ai/intention');

module.exports = (db) => {
    const router = express.Router();

    // Map: Action "detectar_intencion" param "mensaje" -> body.mensaje
    router.post('/intention-detect', (req, res) => {
        try {
            // Support both internal "message" and external Action "mensaje"
            const text = req.body.mensaje || req.body.message;
            if (!text) return res.status(400).json({ error: "Message required" });

            const result = detectIntention(text);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Debug Route
    router.get('/ping', (req, res) => {
        console.log("[DEBUG] Ping hit!");
        res.json({ message: "PONG - Concierge is Public", method: req.method });
    });

    // Catch-all for wrong methods on intention-detect
    router.all('/intention-detect', (req, res) => {
        console.log("[DEBUG] Catch-all intention-detect. Method:", req.method);
        res.status(405).json({ error: "Use POST method", received: req.method });
    });

    return router;
};
