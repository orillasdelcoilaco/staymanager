// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Mantener por si acaso alguna referencia legacy
const path = require('path');
const aiConfig = require('../config/aiConfig');

// Import Providers
const GeminiProvider = require('./ai_providers/geminiProvider');
const OpenAIProvider = require('./ai_providers/openaiProvider');
const AnthropicProvider = require('./ai_providers/anthropicProvider');
const DeepSeekProvider = require('./ai_providers/deepseekProvider');

// Load dotenv only if not in production
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

// --- FACTORY ---
function getProvider(providerType) {
    const type = providerType || aiConfig.provider;

    switch (type) {
        case 'openai':
            return new OpenAIProvider(aiConfig.openai);
        case 'claude':
            return new AnthropicProvider(aiConfig.claude);
        case 'deepseek':
            return new DeepSeekProvider(aiConfig.deepseek);
        case 'siliconflow':
            return new OpenAIProvider(aiConfig.siliconflow);
        case 'moonshot':
            return new OpenAIProvider(aiConfig.moonshot);
        case 'groq':
            return new OpenAIProvider(aiConfig.groq);
        case 'openrouter':
            return new OpenAIProvider(aiConfig.openrouter);
        case 'gemini':
        default:
            if (type !== 'gemini') {
                console.warn(`[AI Service] Unknown provider '${type}', falling back to Gemini.`);
            }
            return new GeminiProvider(aiConfig.gemini);
    }
}

/**
 * Intenta generar JSON con el proveedor principal.
 * Si falla por cuota, prueba los proveedores de fallback en orden.
 * Garantiza que una falla de cuota nunca detenga el flujo sin intentar alternativas.
 */
async function generateWithFallback(prompt) {
    const providerChain = [aiConfig.provider, ...aiConfig.fallbackProviders];

    for (const providerType of providerChain) {
        try {
            const provider = getProvider(providerType);
            const result = await provider.generateJSON(prompt);
            if (result) {
                if (providerType !== aiConfig.provider) {
                    console.log(`[AI Cascade] ✅ Éxito con proveedor fallback: ${providerType}`);
                }
                return result;
            }
        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.warn(`[AI Cascade] ⚠️ Cuota excedida en '${providerType}'. Intentando siguiente proveedor...`);
                continue;
            }
            // Error no relacionado a cuota: propagar
            throw error;
        }
    }

    console.error('[AI Cascade] ❌ Todos los proveedores fallaron o no tienen API key configurada.');
    return null;
}

// --- LEGACY WRAPPER (To maintain backward compatibility with existing routes) ---
// Note: Ideally, all functions should be refactored to use the provider's generic methods.
// For now, we will use the provider to execute the prompts.

async function llamarIASimulada(prompt) {
    if (prompt.includes("generar metadatos SEO")) {
        return JSON.stringify({
            metaTitle: "Alojamiento Turístico | Reserva Directa",
            metaDescription: "Reserva tu estancia con la mejor tarifa garantizada."
        });
    } else if (prompt.includes("generar el contenido principal")) {
        return JSON.stringify({
            h1: "Bienvenidos a Nuestro Alojamiento",
            introParagraph: "Disfruta de una experiencia única."
        });
    } else if (prompt.includes("altText")) {
        return JSON.stringify({
            altText: "[MOCK] Vista del alojamiento (Sin IA)",
            title: "[MOCK] Foto Alojamiento",
            advertencia: null
        });
    } else if (prompt.includes("Estratega de Marca")) {
        return JSON.stringify({
            slogan: "Tu refugio ideal en la naturaleza (Simulado)",
            enfoqueMarketing: "Relax",
            palabrasClaveAdicionales: "alojamiento, turismo, descanso, naturaleza, simulado",
            tipoAlojamientoPrincipal: "Alojamiento Turístico (Simulado)",
            historiaOptimizada: "Esta es una historia optimizada simulada...",
            heroAlt: "Vista del alojamiento simulada",
            heroTitle: "Alojamiento Simulado",
            advertencia: null
        });
    }
    return "Contenido generado automáticamente (Fallback Genérico).";
}

// --- Main API Call Function (Legacy/Internal Helper) ---
async function llamarGeminiAPI(prompt, imageBuffer = null) {
    const API_KEY = aiConfig.gemini.apiKey;
    if (!API_KEY) {
        console.warn("¡ADVERTENCIA! No se encontró la GEMINI_API_KEY. Las funciones de IA usarán respuestas simuladas.");
        return llamarIASimulada(prompt);
    }

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        // Use configured model or default to gemini-2.0-flash (Available in v1beta/recent utils)
        const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        let result;
        if (imageBuffer) {
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp"
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error llamando a Gemini API:", error);
        return llamarIASimulada(prompt);
    }
}

// --- EXPORTED FUNCTIONS ---

const analizarMetadataActivo = async (nombreActivo, categoriasExistentes) => {
    // 0. CATALOG LOOKUP (Level 1 Strategy)
    const normalizedName = nombreActivo.toLowerCase().trim();
    // Import inside function to avoid caching issues during dev, or top level is fine.
    // Assuming file is in ../data/standardAssets.js relative to services/
    let standardAssets = {};
    try {
        standardAssets = require('../data/standardAssets');
    } catch (e) {
        console.warn("Could not load standardAssets library:", e);
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
            confidence: "High",
            reasoning: "Catalog Match: Standard Library"
        };
    }

    // Construct System Prompt
    const prompt = `
        Actúa como un Arquitecto de Información experto en Hospitalidad, SEO y gestión de inventarios.
        Tu tarea es analizar el activo de alojamiento: "${nombreActivo}".

        CONTEXTO:
        Categorías existentes en el sistema: ${JSON.stringify(categoriasExistentes)}.

        OBJETIVO:
        Generar el perfil completo del activo para usarlo en:
        1. Gestión de inventario del alojamiento
        2. SEO para motores de búsqueda (Google Hotels, Booking.com)
        3. Contexto de venta para agentes IA (ChatGPT, Claude, Gemini, DeepSeek)
        4. Schema.org para datos estructurados

        REGLAS:
        1. Si el activo encaja en una categoría existente, ÚSALA (Title Case).
        2. Si no encaja, propón una categoría nueva profesional.
        3. Determina si es contable (múltiples unidades) o binario (tiene/no tiene).
        4. Usa un EMOJI representativo.
        5. "sales_context" debe ser una frase corta en español que un agente IA puede decir al huésped
           (ej: "Cama King para 2 personas con ropa de cama incluida").
        6. "seo_tags" deben ser palabras clave en español que los huéspedes usan al buscar.
        7. "schema_type" usa tipos de Schema.org para alojamientos (LocationFeatureSpecification, BedDetails, etc).

        Responde SOLO con un objeto JSON (sin markdown):
        {
            "category": "String (Categoría, Title Case)",
            "is_new_category": Boolean,
            "capacity": Number (personas que puede alojar, 0 si no aplica. Ej: cama king=2, sofa cama=2),
            "icon": "String (Emoji representativo)",
            "countable": Boolean (true si puede haber 2+ unidades, false si es único),
            "confidence": "High/Medium/Low",
            "reasoning": "Breve explicación",
            "normalized_name": "Nombre correcto en Title Case (ej: Cama King, Toalla de Baño)",
            "requires_photo": Boolean (true si es relevante fotografiar para la web),
            "photo_quantity": Number (cantidad de fotos recomendadas, 0 si no aplica),
            "photo_guidelines": "Instrucción breve para fotografiar (ej: Foto desde 45°, luz natural, cama tendida)",
            "seo_tags": ["tag1", "tag2", "tag3"] (3-6 palabras clave en español),
            "sales_context": "Frase corta para agentes IA de venta (ej: Cama King para 2 personas)",
            "schema_type": "String (tipo Schema.org: LocationFeatureSpecification | BedDetails | FloorPlan)",
            "schema_property": "String (propiedad Schema.org: amenityFeature | bed | occupancy)"
        }
    `;

    try {
        const result = await generateWithFallback(prompt);
        if (!result) throw new Error("Empty result from all providers");
        return result;
    } catch (error) {
        console.error("[AI Service] Error en analizarMetadataActivo:", error);
        if (error.code === 'AI_QUOTA_EXCEEDED') throw error; // propagate quota errors
        console.warn("[AI Service] Falling back to Heuristic Classification for:", nombreActivo);
        return classifyHeuristically(nombreActivo);
    }
};

/**
 * Fallback heurístico para cuando la IA no está disponible.
 * Garantiza que activos comunes tengan iconos y categorías decentes.
 */
function classifyHeuristically(nombre) {
    const n = nombre.toLowerCase().trim();

    // 1. DORMITORIOS
    if (n.includes('cama') || n.includes('bed') || n.includes('colchon') || n.includes('almohada') || n.includes('sabana') || n.includes('closet') || n.includes('percha')) {
        return { category: 'Dormitorio', icon: '🛏️', is_new_category: false, capacity: n.includes('cama') ? 1 : 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Dormitorio' };
    }

    // 2. COCINA
    if (n.includes('cocina') || n.includes('kitchen') || n.includes('microonda') || n.includes('refri') || n.includes('heladera') || n.includes('horno') || n.includes('paila') || n.includes('olla') || n.includes('cubierto') || n.includes('plato') || n.includes('vaso') || n.includes('taza') || n.includes('cafetera') || n.includes('tostadora') || n.includes('hervidor')) {
        return { category: 'Cocina', icon: '🍳', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Cocina' };
    }

    // 3. BAÑO
    if (n.includes('baño') || n.includes('ducha') || n.includes('toalla') || n.includes('jabon') || n.includes('shampoo') || n.includes('wc') || n.includes('inodoro') || n.includes('lavabo') || n.includes('secador') || n.includes('papel')) {
        return { category: 'Baño', icon: '🚿', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Baño' };
    }

    // 4. ESTAR / LIVING
    if (n.includes('sofa') || n.includes('sillon') || n.includes('mesa') || n.includes('silla') || n.includes('tv') || n.includes('tele') || n.includes('estufa')) {
        return { category: 'Estar', icon: '🛋️', is_new_category: false, capacity: n.includes('sofa cama') ? 1 : 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Estar' };
    }

    // 5. EXTERIOR
    if (n.includes('piscina') || n.includes('terraza') || n.includes('parrilla') || n.includes('quincho') || n.includes('jardin') || n.includes('patio') || n.includes('tina') || n.includes('hot tub')) {
        return { category: 'Exterior', icon: '🌲', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Exterior' };
    }

    // 6. TECNOLOGIA
    if (n.includes('wifi') || n.includes('internet') || n.includes('alarma') || n.includes('camara') || n.includes('altavoz') || n.includes('parlante')) {
        return { category: 'Tecnología', icon: '📶', is_new_category: false, capacity: 0, countable: true, confidence: 'Medium', reasoning: 'Heuristic Match: Tecnología' };
    }

    // Default Fallback
    return {
        category: "OTROS",
        is_new_category: false,
        capacity: 0,
        icon: "🔹",
        countable: true,
        confidence: "Low",
        reasoning: "Heuristic Fallback"
    };
}

// 2. Existing Function Refactored: Generate SEO Home Page
const generarSeoHomePage = async (empresaData, contextoExtra = {}) => {
    const { historia, slogan, palabrasClave, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;
    const prompt = `
        Actúa como un Experto SEO Senior. Genera metadatos para la HOME.
        Empresa: "${empresaData.nombre}". Historia: "${historia}".
        Slogan: "${slogan}". Marketing: "${enfoqueMarketing}".
        Responde JSON: { "metaTitle": "...", "metaDescription": "..." }
    `;
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || JSON.parse(await llamarIASimulada("generar metadatos SEO"));
};

// 3. Existing Function Refactored: Generate Home Content
const generarContenidoHomePage = async (empresaData, contextoExtra = {}) => {
    const { historia, slogan, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;
    const prompt = `
        Actúa como Copywriter CRO. Genera contenido Above the Fold.
        Empresa: "${empresaData.nombre}". Slogan: "${slogan}".
        Responde JSON: { "h1": "...", "introParagraph": "..." }
    `;
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || JSON.parse(await llamarIASimulada("generar el contenido principal"));
};

// 4. Existing Function Refactored: Generate Accommodation Description
const generarDescripcionAlojamiento = async (nombre, tipo, ubicacion, servicios, estilo = "Comercial y atractivo") => {
    const prompt = `
        Actúa como Copywriter Inmobiliario. Escribe una descripción para:
        Propiedad: "${nombre}" (${tipo}).
        Ubicación: "${ubicacion}".
        Estilo: "${estilo}".
        Servicios clave: ${servicios}.

        Responde JSON: { "descripcion": "Texto persuasivo...", "puntosFuertes": ["punto1", "punto2"] }
    `;
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    // Fallback logic if needed, or return result directly
    return result || { descripcion: `Bienvenido a ${nombre}, un excelente ${tipo} en ${ubicacion}. Disfruta de ${servicios}.`, puntosFuertes: [] };
};

// 5. Existing Function Refactored: Generate Company Profile
const generarPerfilEmpresa = async (nombre, historia, contexto) => {
    const prompt = `
        Actúa como Estratega de Marca. Genera perfil para:
        Empresa: "${nombre}".
        Historia Base: "${historia}".
        Contexto extra: "${contexto}".

        Responde JSON: { 
            "slogan": "...", 
            "enfoqueMarketing": "...", 
            "palabrasClaveAdicionales": "...", 
            "tipoAlojamientoPrincipal": "...",
            "historiaOptimizada": "..."
        }
    `;
    const provider = getProvider();
    const result = await provider.generateJSON(prompt);
    return result || JSON.parse(await llamarIASimulada("Estratega de Marca"));
};

// 6. Existing Function (Image Metadata)
const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente, imageBuffer, contextoEsperado = null) => {
    // Keep using direct API for images until provider supports it
    let instruccionAuditoria = '';
    if (contextoEsperado) {
        instruccionAuditoria = `
            TAREA CRÍTICA DEL WIZARD: El usuario debe subir específicamente: "${contextoEsperado}".
            Verifica si la imagen cumple con este requisito específico.
            - Si se pide "Vista de la cama" y suben una vista general donde la cama apenas se ve: RECHÁZALO.
            - Si se pide "Detalle del baño" y suben una foto panorámica: RECHÁZALO.
            Si no cumple, el campo 'advertencia' debe decir: "No cumple con el requisito: ${contextoEsperado}".
        `;
    } else {
        instruccionAuditoria = `
            AUDITORÍA GENERAL: ¿La foto coincide con el tipo de espacio "${tipoComponente}"?
            - Si suben un baño y es "Dormitorio": DETECTARLO.
            - Si la foto es borrosa o mala: DETECTARLO.
        `;
    }

    const prompt = `
        Eres un Experto SEO para Google Hotels y un Auditor de Calidad Visual.
        CONTEXTO: Foto para el espacio: "${nombreComponente}" (Categoría: ${tipoComponente}).
        PROPIEDAD: "${nombrePropiedad}" (Empresa: ${nombreEmpresa}).
        DESCRIPCIÓN PROPIEDAD: "${descripcionPropiedad}".
        ${instruccionAuditoria}
        
        TAREAS DE GENERACIÓN DE METADATOS (SEO):
        1. "altText": Genera un texto alternativo optimizado para SEO (máx 125 caracteres).
        2. "title": Un título comercial atractivo (máx 60 caracteres).
        
        Responde SOLO JSON:
        {
            "altText": "...",
            "title": "...",
            "advertencia": "Mensaje corto de error si no cumple la auditoría. Si está bien, pon null."
        }
    `;

    try {
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (!json.altText || !json.title) throw new Error("JSON incompleto");
        return json;
    } catch (e) {
        console.warn("Fallo generación metadata imagen:", e);
        return {
            altText: `${nombreComponente} en ${nombrePropiedad}`,
            title: nombreComponente,
            advertencia: contextoEsperado ? `Error de IA verificando: ${contextoEsperado}. Intente de nuevo.` : null
        };
    }
};

// 7. Generar Estructura de Alojamiento
const generarEstructuraAlojamiento = async (descripcion, tiposDisponibles) => {
    const tiposInfo = tiposDisponibles.map(t => `- ${t.nombreNormalizado} (ID: ${t.id})`).join('\n');
    const prompt = `
        Actúa como un Arquitecto de Datos para un PMS. Analiza la descripción: "${descripcion}".
        Tipos Disponibles: ${tiposInfo}.
        
        Extrae UBICACIÓN y COMPONENTES (Inventario).
        Responde SOLO JSON: { "ubicacion": {...}, "componentes": [...] }
    `;

    try {
        const raw = await llamarGeminiAPI(prompt);
        // Corrected Regex (removed spaces)
        let jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();

        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Error generando estructura:", e);
        return { componentes: [], ubicacion: {} };
    }
};

// 8. Evaluar Fotografías
const evaluarFotografiasConIA = async (prompt) => {
    try {
        const raw = await llamarGeminiAPI(prompt);
        // Corrected Regex
        let jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();

        const firstBracket = jsonStr.indexOf('[');
        const lastBracket = jsonStr.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
        } else {
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
        }

        const resultado = JSON.parse(jsonStr);
        return Array.isArray(resultado) ? resultado : (resultado.requerimientos || []);

    } catch (e) {
        // CRITICAL: Propagate Quota Errors to UI
        if (e.code === 'AI_QUOTA_EXCEEDED') {
            console.error("[CS] Critical AI Quota Error:", e.message);
            throw e; // Bubble up to controller -> Frontend
        }
        console.warn("Fallo evaluación de fotos IA:", e.message);
        return [];
    }
};

module.exports = {
    getProvider,
    generateWithFallback,
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarEstructuraAlojamiento,
    evaluarFotografiasConIA,
    analizarMetadataActivo
};