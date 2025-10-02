const express = require('express');
const router = express.Router();

// --- INICIO DE LA CORRECCIÓN DEFINITIVA ---
// 1. Se usan los nombres de archivo en PLURAL ('presupuestosService', 'clientesService'),
//    confirmados con la nueva lista de archivos que proporcionaste.
const { getAvailabilityData, findNormalCombination, findSegmentedCombination, calculatePrice } = require('../services/presupuestosService');
const { findOrCreateClient } = require('../services/clientesService');
// --- FIN DE LA CORRECCIÓN DEFINITIVA ---

const admin = require('firebase-admin');
const jsonParser = express.json();

module.exports = (db) => {
    
    // Se extrae la lógica principal a una función manejadora para poder reutilizarla.
    const handleGenerarPresupuesto = async (req, res) => {
        const { fechaLlegada, fechaSalida, personas, sinCamarotes, permitirCambios } = req.body;

        if (!fechaLlegada || !fechaSalida || !personas) {
            return res.status(400).json({ error: 'Faltan datos para generar el presupuesto.' });
        }
        const startDate = new Date(fechaLlegada + 'T00:00:00Z');
        const endDate = new Date(fechaSalida + 'T00:00:00Z');
        if (startDate >= endDate) {
            return res.status(400).json({ error: 'La fecha de salida debe ser posterior a la fecha de llegada.' });
        }

        try {
            const { availableCabanas, allCabanas, allTarifas, complexDetails, overlappingReservations } = await getAvailabilityData(db, startDate, endDate);
            
            let result;
            let isSegmented = false;

            if (permitirCambios) {
                result = findSegmentedCombination(allCabanas, allTarifas, overlappingReservations, parseInt(personas), startDate, endDate);
                isSegmented = true;
            } else {
                result = findNormalCombination(availableCabanas, parseInt(personas), sinCamarotes);
            }
            
            const { combination, capacity, dailyOptions } = result;

            if (combination.length === 0) {
                return res.status(200).json({
                    message: 'No hay suficientes cabañas disponibles para la cantidad de personas solicitada.',
                    suggestion: null,
                    availableCabanas,
                    allCabanas,
                    complexDetails
                });
            }

            const pricing = await calculatePrice(db, combination, startDate, endDate, isSegmented);
            res.status(200).json({
                suggestion: { cabanas: combination, totalCapacity: capacity, pricing: pricing, isSegmented: isSegmented, dailyOptions: dailyOptions || null },
                availableCabanas,
                allCabanas,
                complexDetails
            });
        } catch (error) {
            console.error("Error al generar el presupuesto:", error);
            res.status(500).json({ error: 'Error interno del servidor al generar el presupuesto.' });
        }
    };

    // Ruta moderna que debería usarse
    router.post('/generar', jsonParser, handleGenerarPresupuesto);

    // --- INICIO DE LA CORRECCIÓN (ERROR 404) ---
    // Se añade esta ruta como un ALIAS. Tu frontend (generadorPresupuestos.js) llama a '/generar-texto'.
    // Al hacer que esta ruta ejecute la misma función que '/generar', restauramos la funcionalidad
    // y eliminamos el error 404 Not Found.
    router.post('/generar-texto', jsonParser, handleGenerarPresupuesto);
    // --- FIN DE LA CORRECCIÓN (ERROR 404) ---

    router.post('/recalcular', jsonParser, async (req, res) => {
        const { fechaLlegada, fechaSalida, cabanas } = req.body;
        if (!fechaLlegada || !fechaSalida || !cabanas) {
            return res.status(400).json({ error: 'Faltan datos para recalcular el precio.' });
        }
        try {
            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');
            const pricing = await calculatePrice(db, cabanas, startDate, endDate);
            res.status(200).json(pricing);
        } catch (error) {
            console.error("Error al recalcular el precio:", error);
            res.status(500).json({ error: 'Error interno del servidor al recalcular.' });
        }
    });
    
    router.post('/recalcular-segmentado', jsonParser, async (req, res) => {
        const { itinerary } = req.body;
        if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
            return res.status(400).json({ error: 'Se requiere un itinerario válido.' });
        }
        try {
            const allCabanasSnapshot = await db.collection('cabanas').get();
            const allCabanas = allCabanasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const firstDay = new Date(itinerary[0].fechaInicio + 'T00:00:00Z');
            const lastDay = new Date(itinerary[itinerary.length - 1].fechaTermino + 'T00:00:00Z');

            const items = itinerary.map(seg => ({
                cabana: allCabanas.find(c => c.id === seg.cabanaId),
                startDate: new Date(seg.fechaInicio + 'T00:00:00Z'),
                endDate: new Date(seg.fechaTermino + 'T00:00:00Z')
            }));

            const pricing = await calculatePrice(db, items, firstDay, lastDay, true);
            res.status(200).json(pricing);
        } catch(error) {
            console.error("Error al recalcular el itinerario segmentado:", error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    router.post('/guardar', jsonParser, async (req, res) => {
        const { cliente, presupuesto } = req.body;
        if (!cliente || !presupuesto) {
            return res.status(400).json({ error: 'Faltan datos del cliente o del presupuesto.' });
        }
        try {
            const clienteId = await findOrCreateClient(db, cliente);
            const presupuestoData = {
                clienteId: clienteId,
                clienteNombre: cliente.nombre,
                fechaEnvio: admin.firestore.FieldValue.serverTimestamp(),
                fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(presupuesto.fechaLlegada)),
                fechaSalida: admin.firestore.Timestamp.fromDate(new Date(presupuesto.fechaSalida)),
                personas: presupuesto.personas,
                cabanas: presupuesto.cabanasSeleccionadas.map(c => c.nombre),
                valorTotal: presupuesto.valorTotal,
                estado: 'Enviado'
            };
            const docRef = await db.collection('presupuestos').add(presupuestoData);
            res.status(201).json({ message: 'Presupuesto guardado exitosamente', id: docRef.id });
        } catch (error) {
            console.error("Error al guardar el presupuesto:", error);
            res.status(500).json({ error: 'Error interno del servidor al guardar el presupuesto.' });
        }
    });

    return router;
};