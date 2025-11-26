// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load dotenv only if not in production
if (!process.env.RENDER) {
    require('dotenv').config();
}

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("¡ADVERTENCIA! No se encontró la GEMINI_API_KEY. Las funciones de IA usarán respuestas simuladas.");
}

// Initialize the client
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// Use the model gemini-2.5-flash which works for both text and images
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null;

// --- Placeholder Function (Fallback if API fails) ---
async function llamarIASimulada(prompt) {
    console.log("--- Usando respuesta de respaldo (Fallback) ---");
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
            altText: "Vista del alojamiento", 
            title: "Foto Alojamiento",
            advertencia: null 
        });
    }
    return "Contenido generado automáticamente.";
}

// --- Main API Call Function ---
async function llamarGeminiAPI(prompt, imageBuffer = null) {
    if (!model) return llamarIASimulada(prompt);
    
    try {
        let result;
        if (imageBuffer) {
            console.log(`[AI Service] 👁️ Procesando IMAGEN + TEXTO con ${model.model}...`);
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp" // Assuming WebP as sharp converts it before
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            console.log(`[AI Service] 📝 Procesando SOLO TEXTO con ${model.model}...`);
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        let text = response.text();
        
        // Clean Markdown formatting that AI sometimes adds
        return text.replace(/```json/g, '').replace(/```/g, '').trim();

    } catch (error) {
        console.error("Error Gemini API:", error.message);
        return llamarIASimulada(prompt);
    }
}

// 1. SEO Home Page
const generarSeoHomePage = async (empresaData) => {
    const prompt = `
        Actúa como experto SEO. Genera JSON {"metaTitle", "metaDescription"} para la HOME de un sitio de turismo.
        Empresa: "${empresaData.nombre}", Ubicación: "${empresaData.ubicacionTexto || ''}".
        Respuesta SOLO JSON válido.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar metadatos SEO"));
    }
};

// 2. Contenido Home Page
const generarContenidoHomePage = async (empresaData) => {
    const prompt = `
        Actúa como Copywriter. Genera JSON {"h1", "introParagraph"} para HOME.
        Empresa: "${empresaData.nombre}".
        Respuesta SOLO JSON válido.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar el contenido principal"));
    }
};

// 3. Descripción Alojamiento
const generarDescripcionAlojamiento = async (desc, nombre, empresa, ubicacion, tipo, marketing) => {
    const prompt = `
        Mejora esta descripción para "${nombre}" en ${ubicacion}.
        Base: "${desc || ''}". Enfoque: ${marketing}.
        Salida: Texto plano persuasivo.
    `;
    return await llamarGeminiAPI(prompt);
};

// 4. Metadata Imagen (STRICT VISUAL AUDITOR)
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo, imageBuffer) => {
    const prompt = `
        Eres un Auditor de Calidad Hotelera estricto.
        
        CONTEXTO: El usuario dice que esta foto es del espacio: "${componente}" (Categoría: ${tipo}).
        PROPIEDAD: "${propiedad}".

        TAREA DE ANÁLISIS VISUAL:
        1. Identifica qué es realmente la imagen (ej: un baño, una cama, un paisaje, un perro, una cocina).
        2. Compáralo con la Categoría Esperada ("${tipo}").

        FORMATO DE RESPUESTA (JSON ÚNICO):
        {
            "altText": "Descripción visual atractiva y detallada para SEO de lo que REALMENTE se ve en la foto. (Máx 125 chars).",
            "title": "Título comercial corto. (Máx 60 chars).",
            "advertencia": "CAMPO CRÍTICO: Si la imagen NO coincide claramente con la categoría '${tipo}', escribe una advertencia directa y explicativa. 
                            Ejemplo: 'CUIDADO: Has subido un paisaje exterior en la sección de Dormitorio'. 
                            Ejemplo: 'ERROR: Esto parece un baño, no corresponde a Cocina'.
                            Si la imagen coincide o es ambigua pero aceptable, pon null."
        }
    `;
    
    try {
        // Pass the buffer for the model to "see"
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const json = JSON.parse(raw);
        
        // Basic response validation
        if (!json.altText || !json.title) throw new Error("JSON incompleto");
        
        return json;
    } catch (e) {
        console.warn("Fallo generación metadata imagen:", e);
        return { 
            altText: `${componente} en ${propiedad} - ${empresa}`, 
            title: componente, 
            advertencia: null 
        };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage
};