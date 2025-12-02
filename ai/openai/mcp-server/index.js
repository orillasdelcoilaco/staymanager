const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Importar router inteligente
const { detectEmpresaIdFromText } = require('../../router/empresaNameDetector');

// Función para cargar agentes
const fs = require('fs');
function loadAgent(empresaId) {
    const agentPath = path.join(__dirname, '..', '..', 'agentes', 'empresa', empresaId + '.md');
    if (!fs.existsSync(agentPath)) return null;
    return fs.readFileSync(agentPath, 'utf8');
}

const app = express();
app.use(bodyParser.json());

// Health
app.get('/.well-known/ai-mcp', (req, res) => {
    res.json({ status: 'ok', name: 'SuiteManager MCP server' });
});

// Main MCP capabilities
app.post('/mcp/capabilities', (req, res) => {
    res.json({
        name: "SuiteManager Marketplace",
        version: "1.0.0",
        tools: [
            {
                name: "buscar_empresa",
                description: "Detecta empresa por texto del usuario y devuelve el agente interno.",
                input_schema: {
                    type: "object",
                    properties: {
                        consulta: { type: "string" }
                    },
                    required: ["consulta"]
                }
            }
        ]
    });
});

// TOOL: buscar empresa
app.post('/mcp/tools/buscar_empresa', (req, res) => {
    const consulta = req.body.consulta || "";

    const empresaId = detectEmpresaIdFromText(consulta);
    if (!empresaId) return res.json({ success: false, message: "No se encontró empresa." });

    const agent = loadAgent(empresaId);
    if (!agent) return res.json({ success: false, message: "Agente no encontrado en disco." });

    return res.json({
        success: true,
        empresaId,
        agentContent: agent
    });
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
    console.log(`SuiteManager MCP server running on port ${PORT}`);
});
