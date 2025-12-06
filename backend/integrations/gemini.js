// backend/integrations/gemini.js

/**
 * Stub para futura integración con Google Gemini.
 * 
 * @param {Object} agentConfig - Configuración del agente (obtenida de /api/agent-config)
 * @param {Array} messages - Historial de mensajes
 * @returns {Promise<Object>} Respuesta simulada
 */
exports.callGeminiAgent = async (agentConfig, messages) => {
    // TODO: Implementar llamada real a la API de Gemini.
    // Se deberán usar las credenciales desde process.env (ej. GOOGLE_API_KEY).
    // Se basará en agentConfig.manifiesto.gemini.system_instruction.

    console.log("🤖 [Gemini Stub] Llamada recibida para:", agentConfig.nombre_empresa);

    return {
        success: false,
        message: "Gemini integration not implemented yet. This is a stub."
    };
};
