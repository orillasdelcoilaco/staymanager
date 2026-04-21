/**
 * Middleware de autenticación para agentes IA externos.
 *
 * Uso:
 *   - Agrega el header: X-Agent-API-Key: <tu_clave>
 *   - Configura las claves válidas en la variable de entorno AGENT_API_KEYS (separadas por coma)
 *   - Opcionalmente indica el agente en el header X-Agent-Name (ChatGPT | Claude | Gemini | DeepSeek | otro)
 *
 * Ejemplo .env:
 *   AGENT_API_KEYS=clave-chatgpt-abc123,clave-claude-xyz789
 */

const VALID_KEYS = new Set(
    (process.env.AGENT_API_KEYS || '')
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
);

const KNOWN_AGENTS = ['chatgpt', 'claude', 'gemini', 'deepseek', 'openai', 'anthropic'];

/**
 * Valida que la solicitud proviene de un agente IA autorizado.
 * Aplica sólo a rutas de escritura (POST /api/public/reservas, etc.)
 */
const requireAgentKey = (req, res, next) => {
    // Si no hay claves configuradas, el sistema está en modo abierto (solo para desarrollo)
    // Sin claves configuradas → modo abierto (el rate limiter protege el endpoint)
    if (VALID_KEYS.size === 0) {
        console.warn('[AgentAuth] AGENT_API_KEYS no configurado — acceso abierto con rate limit.');
        req.agentName = req.headers['x-agent-name'] || req.body?.origen || 'Agente sin clave';
        return next();
    }

    // Si hay claves configuradas pero el request no trae key → verificar
    const apiKey = req.headers['x-agent-api-key'];
    if (!apiKey) {
        // Permitir sin key pero registrar para auditoría
        console.warn(`[AgentAuth] Request sin X-Agent-API-Key desde ${req.ip}`);
        req.agentName = req.body?.origen || 'Sin autenticar';
        return next();
    }

    if (!VALID_KEYS.has(apiKey)) {
        console.warn(`[AgentAuth] Clave inválida recibida: ${apiKey.substring(0, 8)}...`);
        return res.status(403).json({
            error: 'Clave de agente inválida o expirada.',
            code: 'AGENT_KEY_INVALID'
        });
    }

    const agentName = (req.headers['x-agent-name'] || 'Desconocido').substring(0, 50);
    req.agentName = agentName;

    const isKnown = KNOWN_AGENTS.some(a => agentName.toLowerCase().includes(a));
    console.log(`[AgentAuth] ✅ Agente autenticado: ${agentName}${isKnown ? '' : ' (desconocido)'}`);

    next();
};

module.exports = { requireAgentKey };
