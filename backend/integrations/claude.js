// backend/integrations/claude.js

/**
 * Stub para futura integración con Anthropic Claude.
 * 
 * @param {Object} agentConfig - Configuración del agente (obtenida de /api/agent-config)
 * @param {Array} messages - Historial de mensajes
 * @returns {Promise<Object>} Respuesta simulada
 */
exports.callClaudeAgent = async (agentConfig, messages) => {
    // TODO: Implementar llamada real a la API de Claude.
    // Se deberán usar las credenciales desde process.env (ej. ANTHROPIC_API_KEY).
    // Se basará en agentConfig.manifiesto.claude.system_prompt.

    console.log("🤖 [Claude Stub] Llamada recibida para:", agentConfig.nombre_empresa);

    return {
        success: false,
        message: "Claude integration not implemented yet. This is a stub."
    };
};
