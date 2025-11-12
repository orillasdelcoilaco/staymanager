// backend/routes/propuestas.js

const express = require('express');
const { getAvailabilityData, findNormalCombination, findSegmentedCombination } = require('../services/propuestasService');
// (Añadir esta línea, por ejemplo, en la línea 3)
const { calculatePrice } = require('../services/utils/calculoValoresService');
const { generarTextoPropuesta } = require('../services/mensajeService');
// *** VERIFICACIÓN: Necesitamos obtenerValorDolar aquí también para la ruta /recalcular ***
const { obtenerValorDolar, obtenerValorDolarHoy } = require('../services/dolarService');
const { parseISO, isValid, addDays, format } = require('date-fns');

// --- Helper buildItineraryFromDailyOptions (Sin cambios) ---
// backend/routes/propuestas.js

// --- Helper buildItineraryFromDailyOptions (Corregido) ---
function buildItineraryFromDailyOptions(dailyOptions) {
    if (!dailyOptions || dailyOptions.length === 0) return [];
    
    let itinerary = [];
    const getOptionId = (option) => Array.isArray(option) ? option.map(p => p.id).sort().join('-') : option.id;
    
    // Función helper para obtener el array de propiedades
    const getPropertiesArray = (option) => Array.isArray(option) ? option : [option];

    let currentSegment = {
        option: dailyOptions[0].option,
        // CORREGIDO: Usar 'propiedades' (plural) y guardar el array
        propiedades: getPropertiesArray(dailyOptions[0].option), 
        startDate: dailyOptions[0].date,
        endDate: addDays(dailyOptions[0].date, 1),
        segmentId: getOptionId(dailyOptions[0].option)
    };

    for (let i = 1; i < dailyOptions.length; i++) {
        const day = dailyOptions[i];
        const dayOptionId = getOptionId(day.option);

        if (dayOptionId === currentSegment.segmentId) {
            currentSegment.endDate = addDays(day.date, 1);
        } else {
            // Guardar el segmento anterior
            itinerary.push({
                // CORREGIDO: Usar 'propiedades' (plural)
                propiedades: currentSegment.propiedades,
                startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
                endDate: format(currentSegment.endDate, 'yyyy-MM-dd'),
            });
            // Empezar nuevo segmento
            currentSegment = {
                option: day.option,
                // CORREGIDO: Usar 'propiedades' (plural)
                propiedades: getPropertiesArray(day.option),
                startDate: day.date,
                endDate: addDays(day.date, 1),
                segmentId: dayOptionId
            };
        }
    }

    // Guardar el último segmento
    itinerary.push({
        // CORREGIDO: Usar 'propiedades' (plural)
        propiedades: currentSegment.propiedades,
        startDate: format(currentSegment.startDate, 'yyyy-MM-dd'),
        endDate: format(currentSegment.endDate, 'yyyy-MM-dd'),
    });
    
    return itinerary;
}

module.exports = (db) => {
    const router = express.Router();

    // --- Ruta /generar (Sin cambios) ---
    router.post('/generar', async (req, res) => {
        // ... (Código completo de la ruta /generar) ...
        const { empresaId } = req.user;
        const { fechaLlegada, fechaSalida, personas, permitirCambios, sinCamarotes, canalId, editId } = req.body;
        if (!fechaLlegada || !fechaSalida || !personas || !canalId) return res.status(400).json({ error: 'Se requieren fechas, cantidad de personas y canal.' });
        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');
        if (!isValid(startDate) || !isValid(endDate) || endDate <= startDate) return res.status(400).json({ error: 'Fechas inválidas.' });

        try {
            const [availability, dolar] = await Promise.all([
                getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes, editId),
                obtenerValorDolarHoy(db, empresaId)
            ]);
            const { availableProperties, allProperties, allTarifas, availabilityMap } = availability;
            const valorDolarDia = dolar.valor;
            let result;
            let isSegmented = !!permitirCambios;
            if (isSegmented) {
                result = findSegmentedCombination(allProperties, allTarifas, availabilityMap, parseInt(personas), startDate, endDate);
            } else {
                result = findNormalCombination(availableProperties, parseInt(personas));
            }
            const { combination, capacity } = result;
            if (!combination || combination.length === 0) {
                 console.log(`[Ruta /generar] No se encontró combinación para ${personas}pax. Devolviendo disponibles.`);
                 return res.status(200).json({ message: 'No hay suficientes propiedades disponibles para la capacidad solicitada.', suggestion: null, availableProperties, allProperties });
            }
            console.log(`[Ruta /generar] Combinación encontrada (isSegmented=${isSegmented}):`, combination);
            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalId, valorDolarDia, isSegmented);
            console.log(`[Ruta /generar] Precio calculado:`, pricing);
            let uniquePropertiesInSuggestion = [];
            if (isSegmented) {
                 const propMap = new Map();
                 combination.forEach(opt => { const propsOfDay = Array.isArray(opt.option) ? opt.option : [opt.option]; propsOfDay.forEach(p => propMap.set(p.id, p)); });
                 uniquePropertiesInSuggestion = Array.from(propMap.values());
            } else { uniquePropertiesInSuggestion = combination; }
            console.log(`[Ruta /generar] Propiedades únicas en sugerencia: ${uniquePropertiesInSuggestion.map(p=>p.id).join(', ')}`);
            const itineraryStructure = isSegmented ? buildItineraryFromDailyOptions(combination) : null;
            if(isSegmented) console.log(`[Ruta /generar] Itinerario construido para frontend:`, itineraryStructure);
            res.status(200).json({ suggestion: { propiedades: uniquePropertiesInSuggestion, totalCapacity: capacity, pricing, isSegmented, itinerary: itineraryStructure }, availableProperties, allProperties });
        } catch (error) {
            console.error("[Propuestas Route] /generar: Error capturado:", error);
            res.status(500).json({ error: error.message || 'Error interno del servidor al generar la propuesta.' });
        }
    });

    // --- Ruta /recalcular (Verificar llamada a calculatePrice) ---
    router.post('/recalcular', async (req, res) => {
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

            // Obtener tarifas necesarias
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
            // *** VERIFICACIÓN: Se llama a la función importada 'obtenerValorDolar' ***
            const valorDolarDia = await obtenerValorDolar(db, empresaId, startDate);

            // Llamar a calculatePrice (isSegmented = false)
            // *** VERIFICACIÓN: La función calculatePrice se llama aquí ***
            const pricing = await calculatePrice(db, empresaId, propiedades, startDate, endDate, allTarifas, canalId, valorDolarDia, false);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular precio:", error);
            // *** IMPORTANTE: Devolver el mensaje de error específico ***
            res.status(500).json({ error: error.message || 'Error interno del servidor al recalcular.' });
        }
    });

    // --- Ruta /generar-texto (Sin cambios) ---
    router.post('/generar-texto', async (req, res) => {
        // ... (código existente sin cambios) ...
        try {
            const { empresaId } = req.user;
            const texto = await generarTextoPropuesta(db, empresaId, req.body);
            res.status(200).json({ texto });
        } catch (error) {
            console.error("Error al generar texto de propuesta:", error);
            res.status(500).json({ error: error.message || 'Error interno del servidor.' });
        }
    });

    return router;
};