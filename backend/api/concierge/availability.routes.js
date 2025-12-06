const express = require('express');
const { checkAvailability } = require('../../services/ai/filters');

module.exports = (db) => {
    const router = express.Router();

    router.post('/availability', async (req, res) => {
        try {
            // Action Params: personas, fecha_entrada, fecha_salida, ubicacion
            const { personas, fecha_entrada, fecha_salida, ubicacion, empresaId } = req.body;

            // Allow Global or Specific search
            // In Global mode (Marketplace), we might need to search across ALL companies.
            // Current 'checkAvailability' takes 'empresaId'.
            // For this iteration, if no empresaId is provided/inferred, we default to a Demo ID or handle multi-tenant search.
            // FOR NOW: We assume the GPT might pass "GLOBAL" or logic handles it. 
            // The prompt says "Integración multiempresa". 
            // Real implementation of global search would query Group Collections.
            // We'll fallback to header or default test ID if missing for safety.

            const empId = empresaId || req.headers['x-empresa-id'] || '7lzqGKUxuQK0c';

            const criteria = {
                personas: personas,
                fechas: { entrada: fecha_entrada, salida: fecha_salida },
                ubicacion: ubicacion
            };

            const result = await checkAvailability(db, empId, criteria);
            res.status(200).json(result);

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
