const fs = require('fs');
const path = require('path');

// Index path: /ai/agentes/empresa/index.json
// Generated automatically by your agent creation script
const indexPath = path.join(__dirname, '..', 'agentes', 'empresa', 'index.json');

function loadIndex() {
    if (!fs.existsSync(indexPath)) return [];
    const raw = fs.readFileSync(indexPath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

function detectEmpresaIdFromText(text) {
    text = (text || '').toLowerCase();
    const index = loadIndex();
    let best = { empresaId: null, score: 0, match: null };

    index.forEach(item => {
        const tokens = [item.nombre.toLowerCase(), ...(item.aliases || [])];

        tokens.forEach(token => {
            if (!token) return;
            const occurrences = (text.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            if (occurrences > best.score) {
                best = { empresaId: item.empresaId, score: occurrences, match: token };
            }
        });
    });

    return best.empresaId; // or null
}

module.exports = {
    detectEmpresaIdFromText,
    loadIndex
};
