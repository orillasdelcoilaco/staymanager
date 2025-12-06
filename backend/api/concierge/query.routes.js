/**
 * @fileoverview Main Orchestrator - Final Prompt Logic
 */

const express = require('express');
const { detectIntention } = require('../../services/ai/intention');
const { chooseModel, callLLM } = require('../../services/ai/router');
const { checkAvailability } = require('../../services/ai/filters');

module.exports = (db) => {
    const router = express.Router();

    router.post('/query', async (req, res) => {
        try {
            const { message, empresaId } = req.body;
            const empId = empresaId || req.headers['x-empresa-id'];

            if (!message || !empId) return res.status(400).json({ error: "Message and EmpresaID required" });

            // 1. Intention Detect
            const intentData = detectIntention(message);
            const { intencion, personas, fechas, finDeSemana } = intentData;

            // 2. Availability (Only if Booking related)
            let availabilityData = null;
            if (intencion === 'reserva' || intencion === 'disponibilidad') {
                availabilityData = await checkAvailability(db, empId, { personas, fechas });
            }

            // 3. Choose Model
            const modelName = chooseModel(intencion);

            // 4. Construct Prompt (Matching Global GPT Instructions)
            let prompt = `
                ROL: Asistente de Ventas (Concierge Vendedor).
                OBJETIVO: Lograr reservas.
                
                CONTEXTO:
                - Intención detectada: ${intencion}
                - Mensaje Cliente: "${message}"
                - Disponibilidad Real: ${availabilityData ? JSON.stringify(availabilityData) : "No consultada"}
                
                INSTRUCCIONES:
                1. NO inventes datos. Usa solo 'Disponibilidad Real'.
                2. Si hay opciones, muéstralas (Nombre, Precio, Link).
                3. Si no hay, ofrece buscar en otras fechas.
                4. Sé breve y persuasivo.
                5. Cierra siempre con: "¿Deseas reservar esta opción?"
            `;

            // 5. Call LLM
            console.log(`[Query] Routing to ${modelName} for intent: ${intencion}`);
            const responseText = await callLLM(prompt, modelName);

            // Return standardized response
            res.status(200).json({
                intent: intentData,
                model_used: modelName,
                response: responseText,
                data: availabilityData
            });

        } catch (error) {
            console.error("Query Error:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
