// backend/routes/integrations.js
const express = require('express');
// AÑADIR generateAriFeed a la importación
const { generatePropertyListFeed, generateAriFeed } = require('../services/googleHotelsService');
const { obtenerEmpresaPorDominio } = require('../services/empresaService');

module.exports = (db) => {
    const router = express.Router();

    // Ruta para el feed de propiedades de Google Hotels
    router.get('/google/properties/:empresaId', async (req, res) => {
        try {
            const { empresaId } = req.params;
            if (!empresaId) {
                return res.status(400).send('Falta el ID de la empresa.');
            }

            const xmlFeed = await generatePropertyListFeed(db, empresaId);
            
            res.header('Content-Type', 'application/xml');
            res.send(xmlFeed);

        } catch (error) {
            console.error(`Error generando el feed de Google Hotels para la empresa ${req.params.empresaId}:`, error);
            res.status(500).send('Error interno al generar el feed de propiedades.');
        }
    });

    // --- NUEVA RUTA PARA EL FEED ARI ---
    router.get('/google/ari/:empresaId', async (req, res) => {
        try {
            const { empresaId } = req.params;
             if (!empresaId) {
                return res.status(400).send('Falta el ID de la empresa.');
            }
            
            // Aquí podríamos procesar parámetros de Google si los envía (ej. ?timestamp=...)
            // Por ahora, generamos el feed completo para 90 días.
            console.log(`[Google ARI] Solicitud recibida para empresa ${empresaId}`);
            const xmlFeed = await generateAriFeed(db, empresaId);
            
            res.header('Content-Type', 'application/xml');
            res.send(xmlFeed);
            console.log(`[Google ARI] Feed generado y enviado para empresa ${empresaId}`);

        } catch (error) {
             console.error(`Error generando el feed ARI de Google para la empresa ${req.params.empresaId}:`, error);
             res.status(500).send('Error interno al generar el feed ARI.');
        }
    });

    return router;
};