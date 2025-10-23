// backend/routes/propuestas.js

const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/propuestasService');
const { generarTextoPropuesta } = require('../services/mensajeService');
const { obtenerValorDolarHoy } = require('../services/dolarService');
const { parseISO, isValid, addDays, format } = require('date-fns');

// *** Helper REVISADO para construir itinerario desde dailyOptions (puede incluir arrays) ***
function buildItineraryFromDailyOptions(dailyOptions) {
    if (!dailyOptions || dailyOptions.length === 0) return [];

    let itinerary = [];
    // Función para obtener un ID único para un día (propiedad individual o combinación)
    const getOptionId = (option) => Array.isArray(option) ? option.map(p => p.id).sort().join('-') : option.id;

    let currentSegment = {
        // Guardar la opción completa (puede ser array) y extraer la primera prop como referencia
        option: dailyOptions[0].option,
        propiedad: Array.isArray(dailyOptions[0].option) ? dailyOptions[0].option[0] : dailyOptions[0].option,
        startDate: dailyOptions[0].date,
        endDate: addDays(dailyOptions[0].date, 1),
        segmentId: getOptionId(dailyOptions[0].option) // ID para comparar segmentos
    };

    for (let i = 1; i < dailyOptions.length; i++) {
        const day = dailyOptions[i];
        const dayOptionId = getOptionId(day.option);

        // Si el día siguiente usa la MISMA propiedad O la MISMA COMBINACIÓN
        if (dayOptionId === currentSegment.segmentId) {
            // Extender el segmento
            currentSegment.endDate = addDays(day.date, 1);
        } else {
            // Se rompió el segmento, guardar el anterior y empezar uno nuevo
            itinerary.push({
                // Usar la 'propiedad' de referencia guardada
                propiedad: currentSegment.propiedad,
                startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
                endDate: format(currentSegment.endDate, 'yyyy-MM-dd'),
                // Opcional: Podrías añadir las propiedades reales si es un array
                // propertiesInSegment: Array.isArray(currentSegment.option) ? currentSegment.option : [currentSegment.propiedad]
            });
            currentSegment = {
                option: day.option,
                propiedad: Array.isArray(day.option) ? day.option[0] : day.option,
                startDate: day.date,
                endDate: addDays(day.date, 1),
                segmentId: dayOptionId
            };
        }
    }
    // Pushear el último segmento formateado
    itinerary.push({
        propiedad: currentSegment.propiedad,
        startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
        endDate: format(currentSegment.endDate, 'yyyy-MM-dd'),
        // propertiesInSegment: Array.isArray(currentSegment.option) ? currentSegment.option : [currentSegment.propiedad]
    });
    return itinerary;
}
// *** Fin Helper Revisado ***

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

        if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
             return res.status(400).json({ error: 'Fechas inválidas.' });
        }


        try {
            const [availability, dolar] = await Promise.all([
                getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes),
                obtenerValorDolarHoy(db, empresaId)
            ]);

            const { availableProperties, allProperties, allTarifas, availabilityMap } = availability;
            const valorDolarDia = dolar.valor;

            let result;
            let isSegmented = !!permitirCambios;

            if (isSegmented) {
                // Llama a la versión RESTAURADA de findSegmentedCombination
                result = findSegmentedCombination(allProperties, allTarifas, availabilityMap, parseInt(personas), startDate, endDate);
            } else {
                result = findNormalCombination(availableProperties, parseInt(personas));
            }

            // 'combination' es [{date, option:Prop|Prop[]}] (segmentado) o [Prop1, Prop2...] (normal)
            const { combination, capacity } = result;

            if (!combination || combination.length === 0) {
                 console.log(`[Ruta /generar] No se encontró combinación para ${personas}pax. Devolviendo disponibles.`);
                return res.status(200).json({
                    message: 'No hay suficientes propiedades disponibles para la capacidad solicitada.',
                    suggestion: null,
                    availableProperties, // Disponibles para TODO el periodo
                    allProperties
                });
            }
             console.log(`[Ruta /generar] Combinación encontrada (isSegmented=${isSegmented}):`, combination);


            // Llama a calculatePrice con la 'combination' correcta
            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalId, valorDolarDia, isSegmented);
             console.log(`[Ruta /generar] Precio calculado:`, pricing);

            // Determinar propiedades ÚNICAS involucradas
            let uniquePropertiesInSuggestion = [];
            if (isSegmented) {
                 // Extraer propiedades únicas del array de dailyOptions (combination)
                 const propMap = new Map();
                 combination.forEach(opt => {
                     const propsOfDay = Array.isArray(opt.option) ? opt.option : [opt.option];
                     propsOfDay.forEach(p => propMap.set(p.id, p));
                 });
                 uniquePropertiesInSuggestion = Array.from(propMap.values());
            } else {
                 uniquePropertiesInSuggestion = combination;
            }
             console.log(`[Ruta /generar] Propiedades únicas en sugerencia: ${uniquePropertiesInSuggestion.map(p=>p.id).join(', ')}`);


            // CONSTRUIR EL ITINERARIO para el frontend SI ES SEGMENTADO
            const itineraryStructure = isSegmented ? buildItineraryFromDailyOptions(combination) : null;
             if(isSegmented) console.log(`[Ruta /generar] Itinerario construido para frontend:`, itineraryStructure);

            res.status(200).json({
                suggestion: {
                    propiedades: uniquePropertiesInSuggestion, // Array de propiedades únicas
                    totalCapacity: capacity,
                    pricing,
                    isSegmented,
                    itinerary: itineraryStructure, // Estructura [{propiedad, startDate, endDate}]
                },
                availableProperties, // Para 'Otras disponibles'
                allProperties
            });

        } catch (error) {
            console.error("[Propuestas Route] /generar: Error capturado:", error);
            // Devolver error 500 para que se muestre en el frontend
            res.status(500).json({ error: error.message || 'Error interno del servidor al generar la propuesta.' });
        }
    });

    // Ruta /recalcular (sin cambios recientes)
    router.post('/recalcular', async (req, res) => {
        // ... (código existente sin cambios) ...
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, propiedades, canalId } = req.body;
        if (!fechaLlegada || !fechaSalida || !propiedades || propiedades.length === 0 || !canalId) {
             return res.status(400).json({ error: 'Faltan datos para recalcular.' });
        }
        try {
            const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
            const endDate = parseISO(fechaSalida + 'T00:00:00Z');
             if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) {
                 return res.status(400).json({ error: 'Fechas inválidas.' });
             }

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

            const dolar = await obtenerValorDolar(db, empresaId, startDate);
            const valorDolarDia = dolar;

            // Siempre isSegmented = false aquí porque el usuario seleccionó manualmente
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalId, valorDolarDia, false);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            res.status(500).json({ error: error.message || 'Error interno del servidor.' });
        }
    });

    // Ruta /generar-texto (sin cambios recientes)
    router.post('/generar-texto', async (req, res) => {
        // ... (código existente sin cambios) ...
        try {
            const { empresaId } = req.user;
            // Asegurarse de que el helper 'generarTextoPropuesta' maneje la estructura 'isSegmented' y 'itinerary'
            const texto = await generarTextoPropuesta(db, empresaId, req.body);
            res.status(200).json({ texto });
        } catch (error) {
            console.error("Error al generar texto de propuesta:", error);
            res.status(500).json({ error: error.message || 'Error interno del servidor.' });
        }
    });

    return router;
};