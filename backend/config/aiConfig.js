require('dotenv').config();

const aiConfig = {
    provider: process.env.AI_PROVIDER || 'gemini', // 'gemini', 'openai', 'claude'
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo'
    },
    claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-3-opus'
    }
};

module.exports = aiConfig;
