const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/propuestasService');

module.exports = (db) => {
    const router = express.Router();

    router.post('/generar', async (req, res) => {
        console.log('[Propuestas Route] /generar: Solicitud recibida.');
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, personas, permitirCambios } = req.body;
        console.log(`[Propuestas Route] /generar: Params - empresaId: ${empresaId}, fechaLlegada: ${fechaLlegada}, fechaSalida: ${fechaSalida}, personas: ${personas}, permitirCambios: ${permitirCambios}`);

        if (!fechaLlegada || !fechaSalida || !personas) {
            console.error('[Propuestas Route] /generar: Error - Faltan parámetros.');
            return res.status(400).json({ error: 'Se requieren fechas y cantidad de personas.' });
        }

        const startDate = new Date(fechaLlegada + 'T00:00:00Z');
        const endDate = new Date(fechaSalida + 'T00:00:00Z');

        try {
            console.log('[Propuestas Route] /generar: Llamando a getAvailabilityData...');
            const { availableProperties, allProperties, allTarifas, availabilityMap } = await getAvailabilityData(db, empresaId, startDate, endDate);
            console.log(`[Propuestas Route] /generar: getAvailabilityData retornó ${availableProperties.length} propiedades disponibles.`);
            
            let result;
            let isSegmented = !!permitirCambios;

            if (isSegmented) {
                console.log('[Propuestas Route] /generar: Buscando combinación SEGMENTADA.');
                result = findSegmentedCombination(allProperties, allTarifas, availabilityMap, parseInt(personas), startDate, endDate);
            } else {
                console.log('[Propuestas Route] /generar: Buscando combinación NORMAL.');
                result = findNormalCombination(availableProperties, parseInt(personas));
            }
            
            const { combination, capacity, dailyOptions } = result;
            console.log(`[Propuestas Route] /generar: Combinación encontrada con ${combination.length} elementos.`);

            if (combination.length === 0) {
                console.log('[Propuestas Route] /generar: No se encontró combinación. Respondiendo al cliente.');
                return res.status(200).json({
                    message: 'No hay suficientes propiedades disponibles para la capacidad solicitada.',
                    suggestion: null,
                    availableProperties,
                    allProperties
                });
            }
            
            console.log('[Propuestas Route] /generar: Llamando a calculatePrice...');
            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, isSegmented);
            console.log(`[Propuestas Route] /generar: calculatePrice retornó un precio total de ${pricing.totalPrice}.`);
            
            const propertiesInSuggestion = isSegmented ? combination.map(seg => seg.propiedad) : combination;

            console.log('[Propuestas Route] /generar: Enviando respuesta exitosa al cliente.');
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
            console.error("[Propuestas Route] /generar: ¡ERROR CATASTRÓFICO! Se capturó una excepción:", error);
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
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    return router;
};