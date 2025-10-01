const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/propuestasService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/generar', async (req, res) => {
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, personas, permitirCambios } = req.body;

        if (!fechaLlegada || !fechaSalida || !personas) {
            return res.status(400).json({ error: 'Se requieren fechas y cantidad de personas.' });
        }

        const startDate = new Date(fechaLlegada + 'T00:00:00Z');
        const endDate = new Date(fechaSalida + 'T00:00:00Z');

        try {
            const { availableProperties, allProperties, allTarifas, availabilityMap, allCanales } = await getAvailabilityData(db, empresaId, startDate, endDate);
            
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

            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, allCanales, isSegmented);
            
            const propertiesInSuggestion = isSegmented ? combination.map(seg => seg.propiedad) : combination;

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
        const { fechaLlegada, fechaSalida, propiedades } = req.body;
        if (!fechaLlegada || !fechaSalida || !propiedades) {
            return res.status(400).json({ error: 'Faltan datos para recalcular.' });
        }
        try {
            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');
            
            const { allTarifas, allCanales } = await getAvailabilityData(db, empresaId, startDate, endDate);
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, allCanales);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    return router;
};