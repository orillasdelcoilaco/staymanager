const fs = require('fs');
const path = require('path');

/**
 * Genera el archivo de agente interno para una nueva empresa.
 * @param {string} empresaId - ID de la empresa.
 * @param {string} nombreEmpresa - Nombre de la empresa.
 */
const generateAgentForCompany = async (empresaId, nombreEmpresa) => {
    try {
        const agentesDir = path.join(__dirname, '../agentes/empresa');

        // Asegurar que el directorio existe
        if (!fs.existsSync(agentesDir)) {
            fs.mkdirSync(agentesDir, { recursive: true });
        }

        const filePath = path.join(agentesDir, `${empresaId}.md`);

        const content = `Eres el asistente virtual de ${nombreEmpresa}.
Tu objetivo es ayudar a los clientes a encontrar alojamiento y responder dudas sobre la empresa.
Utiliza las herramientas disponibles para consultar disponibilidad y detalles de alojamientos.
Siempre sé amable y profesional.`;

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[generateAgentForCompany] Agente creado en: ${filePath}`);
        return true;
    } catch (error) {
        console.error('[generateAgentForCompany] Error creando agente:', error);
        throw error;
    }
};

module.exports = { generateAgentForCompany };
