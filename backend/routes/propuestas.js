// backend/routes/propuestas.js

const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/propuestasService');
const { generarTextoPropuesta } = require('../services/mensajeService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/generar', async (req, res) => {
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, personas, permitirCambios, sinCamarotes, canalId } = req.body;

        if (!fechaLlegada || !fechaSalida || !personas || !canalId) {
            return res.status(400).json({ error: 'Se requieren fechas, cantidad de personas y canal.' });
        }

        const startDate = new Date(fechaLlegada + 'T00:00:00Z');
        const endDate = new Date(fechaSalida + 'T00:00:00Z');

        try {
            const { availableProperties, allProperties, allTarifas, availabilityMap } = await getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes);
            
            let result;
            let isSegmented = !!permitirCambios;

            if (isSegmented) {
                result = findSegmentedCombination(allProperties, allTarifas, availabilityMap, parseInt(personas), startDate, endDate);
            } else {
                result = findNormalCombination(availableProperties, parseInt(personas));
            }
            
            const { combination, capacity, dailyOptions } = result;

            if (combination.length === 0) {
                return res.status(200).json({
                    message: 'No hay suficientes propiedades disponibles para la capacidad solicitada.',
                    suggestion: null,
                    availableProperties,
                    allProperties
                });
            }

            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalId, isSegmented);
            
            const propertiesInSuggestion = isSegmented 
                ? combination.flatMap(seg => seg.propiedades) 
                : combination;

            res.status(200).json({
                suggestion: { 
                    propiedades: propertiesInSuggestion, 
                    totalCapacity: capacity, 
                    pricing,
                    isSegmented,
                    itinerary: isSegmented ? combination : null,
                    dailyOptions: dailyOptions || null
                },
                availableProperties,
                allProperties
            });

        } catch (error) {
            console.error("[Propuestas Route] /generar: Error capturado:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    router.post('/recalcular', async (req, res) => {
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, propiedades, canalId } = req.body;
        if (!fechaLlegada || !fechaSalida || !propiedades || !canalId) {
            return res.status(400).json({ error: 'Faltan datos para recalcular.' });
        }
        try {
            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');
            
            const { allTarifas } = await getAvailabilityData(db, empresaId, startDate, endDate);
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalId);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    router.post('/generar-texto', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const texto = await generarTextoPropuesta(db, empresaId, req.body);
            res.status(200).json({ texto });
        } catch (error) {
            console.error("Error al generar texto de propuesta:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};