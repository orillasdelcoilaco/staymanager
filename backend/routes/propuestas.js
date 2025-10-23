// backend/routes/propuestas.js

const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/propuestasService');
const { generarTextoPropuesta } = require('../services/mensajeService');
const { obtenerValorDolarHoy } = require('../services/dolarService');
const { parseISO, isValid, addDays, format } = require('date-fns'); // Asegurar imports

// *** Helper para construir itinerario simple ***
function buildSimpleItinerary(dailyOptions) {
    if (!dailyOptions || dailyOptions.length === 0) return [];

    let itinerary = [];
    let currentSegment = {
        propiedad: dailyOptions[0].option, // option es Prop individual
        startDate: dailyOptions[0].date,
        endDate: addDays(dailyOptions[0].date, 1)
    };

    for (let i = 1; i < dailyOptions.length; i++) {
        const day = dailyOptions[i];
        if (day.option.id === currentSegment.propiedad.id) {
            currentSegment.endDate = addDays(day.date, 1);
        } else {
            // Formatear fechas ANTES de pushear
            itinerary.push({
                ...currentSegment,
                startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
                endDate: format(currentSegment.endDate, 'yyyy-MM-dd')
            });
            currentSegment = {
                propiedad: day.option,
                startDate: day.date,
                endDate: addDays(day.date, 1)
            };
        }
    }
    // Pushear el último segmento formateado
    itinerary.push({
        ...currentSegment,
        startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
        endDate: format(currentSegment.endDate, 'yyyy-MM-dd')
    });
    return itinerary;
}
// *** Fin Helper ***

module.exports = (db) => {
    const router = express.Router();

    router.post('/generar', async (req, res) => {
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, personas, permitirCambios, sinCamarotes, canalId } = req.body;

        if (!fechaLlegada || !fechaSalida || !personas || !canalId) {
            return res.status(400).json({ error: 'Se requieren fechas, cantidad de personas y canal.' });
        }

        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');

        // Validar fechas
        if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
             return res.status(400).json({ error: 'Fechas inválidas.' });
        }


        try {
            const [availability, dolar] = await Promise.all([
                getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes),
                obtenerValorDolarHoy(db, empresaId) // Usar hoy para referencia, calculatePrice usará fecha de llegada
            ]);

            const { availableProperties, allProperties, allTarifas, availabilityMap } = availability;
            const valorDolarDia = dolar.valor; // Dólar de hoy como fallback inicial

            let result;
            let isSegmented = !!permitirCambios;

            if (isSegmented) {
                // Llama a la versión SIMPLIFICADA de findSegmentedCombination
                result = findSegmentedCombination(allProperties, allTarifas, availabilityMap, parseInt(personas), startDate, endDate);
            } else {
                result = findNormalCombination(availableProperties, parseInt(personas));
            }

            // 'combination' puede ser [Prop1, Prop2...] (normal) o [{date, option:Prop}, ...] (segmentado simplificado)
            const { combination, capacity, dailyOptions } = result;

            if (!combination || combination.length === 0) {
                return res.status(200).json({
                    message: 'No hay suficientes propiedades disponibles para la capacidad solicitada.',
                    suggestion: null,
                    availableProperties, // Disponibles para todo el periodo
                    allProperties
                });
            }

            // Llama a calculatePrice
            // - Si es segmentado, 'combination' es el array de dailyOptions
            // - Si es normal, 'combination' es el array de propiedades [Prop1, Prop2...]
            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalId, valorDolarDia, isSegmented);

            // Determinar las propiedades ÚNICAS involucradas
            let uniquePropertiesInSuggestion = [];
            if (isSegmented) {
                // Extraer propiedades únicas del array dailyOptions (combination)
                 uniquePropertiesInSuggestion = Array.from(new Map(combination.map(opt => [opt.option.id, opt.option])).values());
            } else {
                 uniquePropertiesInSuggestion = combination;
            }


            // *** CONSTRUIR EL ITINERARIO CORRECTAMENTE SI ES SEGMENTADO ***
            const itineraryStructure = isSegmented ? buildSimpleItinerary(combination) : null;

            res.status(200).json({
                suggestion: {
                    propiedades: uniquePropertiesInSuggestion, // Array de propiedades únicas involucradas
                    totalCapacity: capacity,
                    pricing,
                    isSegmented,
                    itinerary: itineraryStructure, // La estructura que espera el frontend
                    // dailyOptions: dailyOptions || null // Opcional si el frontend lo necesita
                },
                availableProperties, // Disponibles para todo el periodo (para 'Otras disponibles')
                allProperties // Todas las propiedades (para referencia si es necesario)
            });

        } catch (error) {
            console.error("[Propuestas Route] /generar: Error capturado:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // Ruta /recalcular (sin cambios recientes)
    router.post('/recalcular', async (req, res) => {
        // ... (código existente sin cambios) ...
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, propiedades, canalId } = req.body;
        if (!fechaLlegada || !fechaSalida || !propiedades || !canalId) {
            return res.status(400).json({ error: 'Faltan datos para recalcular.' });
        }
        try {
            const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
            const endDate = parseISO(fechaSalida + 'T00:00:00Z');
             if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
                 return res.status(400).json({ error: 'Fechas inválidas.' });
             }

            // Obtener tarifas necesarias para recalcular
            const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
             const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 let inicio = null, termino = null;
                 try {
                    inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                    termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
                    if (!isValid(inicio) || !isValid(termino)) throw new Error('Fecha inválida');
                 } catch(e){ return null; }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
             }).filter(Boolean);

            // Obtener dólar para fecha de llegada
            const dolar = await obtenerValorDolar(db, empresaId, startDate); // Usar fecha de llegada
            const valorDolarDia = dolar; // Asumiendo que obtenerValorDolar devuelve el número directamente

            // Llamar a calculatePrice (siempre isSegmented = false para recalcular selección manual)
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalId, valorDolarDia, false);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // Ruta /generar-texto (sin cambios recientes)
    router.post('/generar-texto', async (req, res) => {
        // ... (código existente sin cambios) ...
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