// backend/routes/ical.js
const express = require('express');
const { getICalForProperty } = require('../services/icalService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/:empresaId/:propiedadId.ics', async (req, res) => {
        try {
            const { empresaId, propiedadId } = req.params;
            
            const icalData = await getICalForProperty(db, empresaId, propiedadId);
            
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="calendar.ics"`);
            res.send(icalData);
            
        } catch (error) {
            console.error(`Error al generar el iCal para la propiedad ${req.params.propiedadId}:`, error);
            res.status(500).send('Error al generar el calendario.');
        }
    });

    return router;
};