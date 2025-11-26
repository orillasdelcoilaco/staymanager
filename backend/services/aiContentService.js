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

// 4. Metadata Imagen (WITH VISUAL AUDITOR)
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo, imageBuffer) => {
    const prompt = `
        Actúa como un Auditor de Calidad Visual para hoteles y experto SEO.
        
        ESTÁS VIENDO: Una foto subida por el usuario para el espacio: "${componente}" (Tipo esperado: ${tipo}).
        PROPIEDAD: "${propiedad}".
        EMPRESA: "${empresa}".

        TAREAS:
        1. **altText**: Describe VISUALMENTE lo que ves en la foto con detalle (colores, materiales, vistas, objetos clave) para SEO. (Máx 125 chars).
        2. **title**: Un título corto y atractivo. (Máx 60 chars).
        3. **AUDITORÍA**: ¿La foto coincide con el tipo "${tipo}"?
           - Si suben un baño y es "Dormitorio": DETECTARLO.
           - Si suben un paisaje y es "Cocina": DETECTARLO.
           - Si la foto es borrosa o mala: DETECTARLO.

        Responde SOLO JSON:
        {
            "altText": "...",
            "title": "...",
            "advertencia": "Mensaje corto al usuario si hay error (ej: 'Parece un baño, no un dormitorio'). Si está bien, pon null."
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