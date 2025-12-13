// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Mantener por si acaso alguna referencia legacy
const path = require('path');
const aiConfig = require('../config/aiConfig');

// Import Providers
const GeminiProvider = require('./ai_providers/geminiProvider');

// Load dotenv only if not in production
if (!process.env.RENDER) {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

// --- FACTORY ---
function getProvider() {
    const providerType = aiConfig.provider;

    switch (providerType) {
        case 'gemini':
            return new GeminiProvider(aiConfig.gemini);
        default:
            console.warn(`[AI Service] Unknown provider '${providerType}', falling back to Gemini.`);
            return new GeminiProvider(aiConfig.gemini);
    }
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

// 1. New Function: Analyze Asset Metadata (Taxonomy Evolution)
const analizarMetadataActivo = async (nombreActivo, categoriasExistentes) => {
    const provider = getProvider();

    // Construct System Prompt
    const prompt = `
        Actúa como un Arquitecto de Información experto en Hospitalidad y gestión de inventarios.
        Tu tarea es analizar el activo: "${nombreActivo}".
        
        CONTEXTO:
        Categorías existentes en el sistema: ${JSON.stringify(categoriasExistentes)}.
        
        OBJETIVO:
        Determinar la mejor categoría para este activo y sus metadatos base.
        
        REGLAS:
        1. Si el activo encaja claramente en una categoría existente, ÚSALA.
        2. Si el activo NO encaja (es algo totalmente nuevo), propón una NUEVA categoría profesional y lógica.
        3. Determina si es contable (se pueden tener varios) o si es binario (tiene/no tiene).
        4. Sugiere un ícono de FontAwesome (v6) adecuado (ej: 'fa-bed').
        
        Responde SOLO con un objeto JSON (sin markdown):
        {
            "category": "String (nombre de categoría)",
            "is_new_category": Boolean,
            "capacity": Number (0 si no aplica, o capacidad típica ej: cama=2),
            "icon": "String (clase fa)",
            "countable": Boolean,
            "confidence": "High/Medium/Low",
            "reasoning": "Breve explicación de tu decisión"
        }
    `;

    try {
        const result = await provider.generateJSON(prompt);
        if (!result) throw new Error("Empty result from provider");
        return result;
    } catch (error) {
        console.error("[AI Service] Error en analizarMetadataActivo:", error);
        // Fallback simple
        return {
            category: "Otros",
            is_new_category: false,
            capacity: 0,
            icon: "fa-box",
            countable: true,
            confidence: "Low",
            reasoning: "Fallback parsing error."
        };
    }
};

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
        console.warn("Fallo evaluación de fotos IA:", e.message);
        return [];
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarEstructuraAlojamiento,
    evaluarFotografiasConIA,
    analizarMetadataActivo
};