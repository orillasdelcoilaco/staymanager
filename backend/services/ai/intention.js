/**
 * @fileoverview Intention Detection Service (Rule-based) - Final Version
 * Classifies user messages without using LLMs.
 */

const { nextFriday, nextSunday, format } = require('date-fns');

const INTENTS = {
    RESERVA: 'reserva',
    DISPONIBILIDAD: 'disponibilidad',
    FECHAS: 'fechas',
    PRECIO: 'precio',
    UBICACION: 'ubicación',
    TRIVIAL: 'trivial', // clima, distancia, turismo
    FOTOS: 'mostrar fotos',
    MAS_FOTOS: 'más fotos',
    HUMANO: 'humano'
};

/**
 * Detects the intent of a user message.
 * @param {string} text 
 * @returns {object} { intencion, personas, fechas, finDeSemana, ubicacion }
 */
function detectIntention(text) {
    const lowerText = text.toLowerCase();

    // Result object
    let result = {
        intencion: INTENTS.TRIVIAL,
        personas: null, // number
        fechas: null, // { entrada, salida }
        finDeSemana: false, // boolean
        ubicacion: null // string
    };

    // 1. Detect Intent
    if (lowerText.match(/(reserva|reservar|quiero ir|arrendar|alquilar|busco|necesito|quisiera|interesa)/)) {
        result.intencion = INTENTS.RESERVA;
    } else if (lowerText.match(/(disponible|disponibilidad|libre|hay lugar|tienes lugar)/)) {
        result.intencion = INTENTS.DISPONIBILIDAD;
    } else if (lowerText.match(/(precio|costo|valor|cuanto sale|cuanto cuesta)/)) {
        result.intencion = INTENTS.PRECIO;
    } else if (lowerText.match(/(fecha|cuando|dias|noches)/)) {
        result.intencion = INTENTS.FECHAS;
    } else if (lowerText.match(/(ubicacion|donde queda|llegar|mapa|direccion)/)) {
        result.intencion = INTENTS.UBICACION;
    } else if (lowerText.match(/(mas fotos|otras fotos|ver mas|detalle)/)) {
        result.intencion = INTENTS.MAS_FOTOS;
    } else if (lowerText.match(/(foto|fotos|imagen|imagenes|ver|mostrar)/)) {
        result.intencion = INTENTS.FOTOS;
    } else if (lowerText.match(/(humano|persona|agente|ayuda|soporte)/)) {
        result.intencion = INTENTS.HUMANO;
    }

    // 2. Extract Entities

    // Personas (pax)
    // "4 personas", "somos 4", "para 2"
    const paxMatch = lowerText.match(/(?:somos|para)\s*(\d+)/) || lowerText.match(/(\d+)\s*(?:personas|px|pax|huéspedes)/);
    if (paxMatch) {
        result.personas = parseInt(paxMatch[1]);
    }

    // Fin de Semana / Fechas
    if (lowerText.match(/(fin de semana|finde)/)) {
        result.finDeSemana = true;
        const today = new Date();
        const start = nextFriday(today);
        const end = nextSunday(start);
        result.fechas = {
            entrada: format(start, 'yyyy-MM-dd'),
            salida: format(end, 'yyyy-MM-dd')
        };
    }

    // Ubicación extraction (Simple heuristic)
    // "en Pucón", "en Villarrica", "hacia el sur", "a Pucón"
    const locMatch = lowerText.match(/\b(en|hacia|cerca de|hasta|a)\s+([a-záéíóúñ\s]+)/);
    if (locMatch && locMatch[2]) {
        // Simple clean up, taking first 2 words if long string to avoid capturing full sentence
        const words = locMatch[2].trim().split(' ');
        const locationCandidate = words.slice(0, 2).join(' '); // "pucon", "villarrica centro"

        // Filter out common false positives if needed, or allow flexibility
        if (!['el', 'la', 'los', 'las'].includes(locationCandidate)) {
            // Remove trailing " para", " por", " y"
            result.ubicacion = locationCandidate
                .replace(/\s+(para|por|en|y|de|con|sin)$/i, '')
                .trim();
            result.ubicacion = result.ubicacion.charAt(0).toUpperCase() + result.ubicacion.slice(1);
        }
    }

    return result;
}

module.exports = {
    detectIntention,
    INTENTS
};
