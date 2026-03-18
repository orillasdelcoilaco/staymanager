/**
 * @typedef {import('../types').PropuestaEspacio} PropuestaEspacio
 */

// 1. DICCIONARIO AL INICIO
const DICCIONARIO_LABELS = {
    "master suite": "Dormitorio Principal",
    "master bedroom": "Dormitorio Principal",
    "living": "Sala de Estar",
    "living room": "Sala de Estar",
    "parking": "Estacionamiento",
    "toilet": "Baño de Visitas",
    "walking closet": "Vestidor",
    "walk-in closet": "Vestidor",
    "kitchen": "Cocina",
    "bano": "Baño",
    "baño en suite": "Baño Privado"
};

/**
 * Helper para obtener el nombre en español bonito.
 */
function obtenerNombreEspacio(tipoInput) {
    const key = tipoInput.toLowerCase().trim();
    // Busca coincidencia exacta o parcial
    for (const [english, spanish] of Object.entries(DICCIONARIO_LABELS)) {
        if (key.includes(english)) return spanish;
    }
    // Si no hay traducción, capitaliza la primera letra del input original
    return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Genera meta description SEO optimizada.
 * @param {string} tipoEspacio
 * @param {string[]} activos
 * @returns {string}
 */
function generarMetaDescription(tipoEspacio, activos) {
    const nombreBonito = obtenerNombreEspacio(tipoEspacio);
    const base = `Descubre este increíble ${nombreBonito}`;
    const features = activos.slice(0, 2).join(', ').toLowerCase();
    const suffix = 'ideal para tu estadía.';
    return `${base} con ${features}. ${suffix}`.substring(0, 160);
}

/**
 * Genera h1 optimizado.
 * @param {string} tipoEspacio
 * @param {string} detalles
 * @param {string[]} activos
 * @returns {string}
 */
function generarH1(tipoEspacio, detalles, activos) {
    const nombreBonito = obtenerNombreEspacio(tipoEspacio);
    // Si hay detalles cortos (menos de 20 chars), úsalos. Si no, usa el activo principal.
    const safeActivos = activos || [];
    const sufijo = (detalles && detalles.length < 20)
        ? detalles
        : (safeActivos[0] || 'Espacio Exclusivo');

    return `${nombreBonito} - ${sufijo}`;
}

/**
 * Genera un prompt optimizado para que una IA evalúe qué fotos son necesarias.
 * Sustituye a la lógica hardcoded anterior.
 * 
 * @param {string} tipoEspacio 
 * @param {string[]} activos 
 * @returns {string} El prompt para el LLM.
 */
function generarPromptParaEvaluacionDeFotos(tipoEspacio, activos) {
    return `
    Actúa como un Director de Arte y Experto en SEO Inmobiliario.
    Estás analizando un espacio del tipo "${tipoEspacio}".
    Lista de Activos disponibles: ${JSON.stringify(activos)}.

    TU MISIÓN:
    Selecciona estrictamente qué activos requieren una fotografía para maximizar la conversión de reservas y el SEO.
    
    CRITERIOS DE SELECCIÓN FOTOGRÁFICA (Lean & Marketing Trust):
    
    1. ELEMENTOS DIFERENCIADORES (High Value) -> REQUIEREN FOTO DEDICADA:
       - Vistas panorámicas, Hot Tubs, Piscinas, Camas King, Terrazas.
       - Formato: "Foto Detalle de [Elemento] destacando [atributo]."

    2. ELEMENTOS FUNCIONALES (Trust/Validación) -> REQUIEREN FOTO DE CONTEXTO:
       - No pedir foto individual de: Hervidor, Tostadora, Secador, Caja Fuerte.
       - INSTRUCCIÓN: Agruparlos en una toma general.
       - Formato: "Foto General de [Ubicación] que incluya visiblemente [Elemento 1, Elemento 2]."

    3. ELEMENTOS TRIVIALES -> IGNORAR:
       - Cubiertos, Basureros, Perchas estándar.

    Devuelve un JSON con la lista de fotos requeridas. Formato: [{"activo": "...", "motivo_relevancia": "...", "metadata_sugerida": "..."}]
  `;
}

/**
 * Genera la propuesta completa del espacio.
 * @param {string} tipoEspacio
 * @param {string[]} activosSeleccionados
 * @param {string} [detallesAdicionales='']
 * @returns {PropuestaEspacio}
 */
function generarPropuestaDeEspacio(tipoEspacio, activosSeleccionados = [], detallesAdicionales = '') {
    const nombreBonito = obtenerNombreEspacio(tipoEspacio);

    const seoTitle = `${nombreBonito} | Alojamiento Exclusivo`;
    const seoDesc = generarMetaDescription(tipoEspacio, activosSeleccionados);

    // Pasamos activosSeleccionados a generarH1
    const h1 = generarH1(tipoEspacio, detallesAdicionales, activosSeleccionados);

    const descripcionCorta = `Disfruta de este ${nombreBonito.toLowerCase()} equipado con ${activosSeleccionados.join(', ').toLowerCase()}.`;
    const descripcionLarga = `${descripcionCorta} ${detallesAdicionales}. Diseñado para confort y funcionalidad.`;

    // YA NO calculamos requerimientosFotos aquí con lógica simple.
    // Delegamos la inteligencia a un prompt que el sistema deberá procesar.
    const promptFotos = generarPromptParaEvaluacionDeFotos(tipoEspacio, activosSeleccionados);

    return {
        seo: {
            title: seoTitle.substring(0, 60),
            metaDescription: seoDesc,
            h1: h1
        },
        ssr: {
            descripcionCorta,
            descripcionLarga
        },
        requerimientosFotos: [], // Se deja vacío intencionalmente. Debe llenarse procesando el prompt.
        promptFotos, // Nuevo campo con la instrucción para la IA
        tokensEstimados: 150
    };
}

const { evaluarFotografiasConIA } = require('./aiContentService');

/**
 * Genera la propuesta completa del espacio (ASÍNCRONA - REAL AI).
 * Ahora conecta con el AI Service para evaluar el prompt generado.
 * 
 * @param {string} tipoEspacio
 * @param {string[]} activosSeleccionados
 * @param {string} [detallesAdicionales='']
 * @returns {Promise<PropuestaEspacio>}
 */
async function generarPropuestaDeEspacioAsync(tipoEspacio, activosSeleccionados = [], detallesAdicionales = '') {
    // 1. Generamos la base (Prompt + SEO + H1 + SSR)
    const propuestaBase = generarPropuestaDeEspacio(tipoEspacio, activosSeleccionados, detallesAdicionales);

    // 2. Si no hay activos, no gastamos tokens
    if (!activosSeleccionados || activosSeleccionados.length === 0) {
        return propuestaBase;
    }

    // 3. Llamada al Brain (AI Service)
    // El prompt ya viene generado dentro de propuestaBase.promptFotos
    console.log(`[LogicaEspacios] Solicitando evaluación IA para ${tipoEspacio}...`);
    const evaluacionIA = await evaluarFotografiasConIA(propuestaBase.promptFotos);

    // 4. Hydration (Mezcla de resultados)
    propuestaBase.requerimientosFotos = evaluacionIA;

    // 5. Ajuste final de Tokens (Real vs Estimado)
    propuestaBase.tokensEstimados = 0; // Ya se consumieron

    return propuestaBase;
}

module.exports = { generarPropuestaDeEspacio, generarPromptParaEvaluacionDeFotos, generarPropuestaDeEspacioAsync };
