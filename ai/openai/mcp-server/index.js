// Minimal MCP server skeleton for SuiteManager Global App
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Health check for Apps SDK
app.get('/.well-known/ai-mcp', (req, res) => {
    res.json({
        status: 'ok',
        name: 'SuiteManager MCP server'
    });
});

// Main MCP capabilities endpoint
app.post('/mcp/capabilities', (req, res) => {
    res.json({
        name: "SuiteManager Marketplace",
        version: "1.0.0",
        tools: [] // populated later with OpenAPI actions or runtime tools
    });
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
    console.log(`SuiteManager MCP server running on port ${PORT}`);
});
