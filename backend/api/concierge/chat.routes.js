/**
 * @fileoverview Public Chat API for Concierge
 */

const express = require('express');
const { routeRequest } = require('../../services/ai/router');

module.exports = (db) => {
    const router = express.Router();

    // POST /api/concierge/chat
    router.post('/chat', async (req, res) => {
        try {
            // "req.empresaId" is injected by the Tenant Resolver middleware (available in public routes if identified by subdom)
            // If checking from a widget on another site, we might need to look up by API Key or Origin.
            // For SSR context, origin/host header identifies the tenant.

            // NOTE: req.empresa is populated by tenantResolver in index.js for "/" routes.
            // For "/api", we need to ensure we know which company this is.
            // Usually passed via Header "x-empresa-id" or derived from Host.

            // Let's assume the frontend sends 'empresaId' in body or header query for now, 
            // or we reuse the tenantResolver logic if mounted under the same middleware.

            const empresaId = req.body.empresaId || req.headers['x-empresa-id'];
            const { message, context } = req.body; // context: { history: [], pax: 2, etc }

            if (!empresaId) {
                return res.status(400).json({ error: 'Falta empresaId' });
            }

            if (!message) {
                return res.status(400).json({ error: 'Mensaje vacío' });
            }

            const response = await routeRequest(db, empresaId, message, context);
            res.status(200).json(response);

        } catch (error) {
            console.error("Chat API Error:", error);
            res.status(500).json({ error: "Error interno del asistente." });
        }
    });

    return router;
};
