/**
 * Clasificación de activos y análisis de metadata (extraído de aiContentService).
 */

function classifyHeuristically(nombre) {
    const n = nombre.toLowerCase().trim();

    if (n.includes('cama') || n.includes('bed') || n.includes('colchon') || n.includes('almohada') || n.includes('sabana') || n.includes('closet') || n.includes('percha')) {
        return { category: 'Dormitorio', icon: '🛏️', is_new_category: false, capacity: n.includes('cama') ? 1 : 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Dormitorio' };
    }

    if (n.includes('cocina') || n.includes('kitchen') || n.includes('microonda') || n.includes('refri') || n.includes('heladera') || n.includes('horno') || n.includes('paila') || n.includes('olla') || n.includes('cubierto') || n.includes('plato') || n.includes('vaso') || n.includes('taza') || n.includes('cafetera') || n.includes('tostadora') || n.includes('hervidor')) {
        return { category: 'Cocina', icon: '🍳', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Cocina' };
    }

    if (n.includes('baño') || n.includes('ducha') || n.includes('toalla') || n.includes('jabon') || n.includes('shampoo') || n.includes('wc') || n.includes('inodoro') || n.includes('lavabo') || n.includes('secador') || n.includes('papel')) {
        return { category: 'Baño', icon: '🚿', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Baño' };
    }

    if (n.includes('sofa') || n.includes('sillon') || n.includes('mesa') || n.includes('silla') || n.includes('tv') || n.includes('tele') || n.includes('estufa')) {
        return { category: 'Estar', icon: '🛋️', is_new_category: false, capacity: n.includes('sofa cama') ? 1 : 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Estar' };
    }

    if (n.includes('piscina') || n.includes('terraza') || n.includes('parrilla') || n.includes('quincho') || n.includes('jardin') || n.includes('patio') || n.includes('tina') || n.includes('hot tub')) {
        return { category: 'Exterior', icon: '🌲', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Exterior' };
    }

    if (n.includes('wifi') || n.includes('internet') || n.includes('alarma') || n.includes('camara') || n.includes('altavoz') || n.includes('parlante')) {
        return { category: 'Tecnología', icon: '📶', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Tecnología' };
    }

    return {
        category: 'OTROS',
        is_new_category: false,
        capacity: 0,
        icon: '🔹',
        countable: true,
        confidence: 'Low',
        reasoning: 'Heuristic Fallback',
    };
}

async function analizarMetadataActivo(nombreActivo, categoriasExistentes, { generateWithFallback, promptsProperty }) {
    const normalizedName = nombreActivo.toLowerCase().trim();
    let standardAssets = {};
    try {
        standardAssets = require('../data/standardAssets');
    } catch (e) {
        console.warn('Could not load standardAssets library:', e);
    }

    if (standardAssets[normalizedName]) {
        console.log(`[AI Service] Instant Match in Catalog for: "${nombreActivo}"`);
        const match = standardAssets[normalizedName];
        return {
            category: match.category,
            is_new_category: false,
            capacity: match.capacity || 0,
            icon: match.icon,
            countable: true,
            confidence: 'High',
            reasoning: 'Catalog Match: Standard Library',
        };
    }

    const prompt = promptsProperty.promptMetadataActivo({
        nombreActivo,
        categoriasExistentes: JSON.stringify(categoriasExistentes),
    });

    try {
        const result = await generateWithFallback(prompt);
        if (!result) throw new Error('Empty result from all providers');
        return result;
    } catch (error) {
        console.error('[AI Service] Error en analizarMetadataActivo:', error);
        if (error.code === 'AI_QUOTA_EXCEEDED') throw error;
        console.warn('[AI Service] Falling back to Heuristic Classification for:', nombreActivo);
        return classifyHeuristically(nombreActivo);
    }
}

module.exports = {
    classifyHeuristically,
    analizarMetadataActivo,
};
