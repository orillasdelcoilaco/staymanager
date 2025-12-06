/**
 * @fileoverview AI Router Service - Final
 * Selects the appropriate AI model based on intention complexity.
 */

const { INTENTS } = require('./intention');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GEMINI_API_KEY;

// Models
const MODELS = {
    CHEAP: "gemini-1.5-flash",
    POWERFUL: "gemini-1.5-pro",
};

/**
 * Selects the best model for the given intention.
 */
function chooseModel(intencion) {
    switch (intencion) {
        case INTENTS.TRIVIAL: // clima, distancia
        case INTENTS.UBICACION:
        case INTENTS.PRECIO:
            return MODELS.CHEAP;

        case INTENTS.RESERVA: // "ventas/reservas" -> Potente
        case INTENTS.DISPONIBILIDAD:
        case INTENTS.HUMANO: // "conversión final"
            return MODELS.POWERFUL;

        case INTENTS.FOTOS:
        case INTENTS.MAS_FOTOS:
            // Technically router shouldn't be called for photos if logic is handled by actions,
            // but if it is, Cheap is fine.
            return MODELS.CHEAP;

        default:
            return MODELS.CHEAP;
    }
}

async function callLLM(prompt, modelName = MODELS.CHEAP) {
    if (!API_KEY) {
        return "Simulación: Hola, soy el Asistente Global. ¿Deseas reservar?";
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error(`LLM Error (${modelName}):`, error.message);
        return "Lo siento, tuve un problema técnico. ¿Deseas reservar esta opción?";
    }
}

module.exports = {
    chooseModel,
    callLLM,
    MODELS
};
