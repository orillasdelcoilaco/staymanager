// backend/routes/integrations.js
const express = require('express');
const { generatePropertyListFeed } = require('../services/googleHotelsService');
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

    return router;
};