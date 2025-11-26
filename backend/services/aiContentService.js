// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.RENDER) {
    require('dotenv').config();
}

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("¡ADVERTENCIA! No se encontró la GEMINI_API_KEY. Las funciones de IA usarán respuestas simuladas.");
}

// Inicializar el cliente
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// *** CORRECCIÓN CRÍTICA: Usar el modelo validado por el usuario ***
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null;

// --- Función Placeholder (Respaldo) ---
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
    }
    return "Contenido generado automáticamente.";
}

async function llamarGeminiAPI(prompt, imageBuffer = null) {
    if (!model) return llamarIASimulada(prompt);
    
    try {
        let result;
        if (imageBuffer) {
            console.log(`[AI Service] Enviando imagen y prompt al modelo ${model.model}...`);
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp"
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            console.log(`[AI Service] Enviando texto al modelo ${model.model}...`);
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        let text = response.text();
        
        // Limpieza de formato Markdown
        return text.replace(/```json/g, '').replace(/```/g, '').trim();

    } catch (error) {
        console.error("Error Gemini API:", error.message);
        return llamarIASimulada(prompt);
    }
}

// 1. SEO Home Page
const generarSeoHomePage = async (empresaData) => {
    const prompt = `
        Actúa como experto SEO. Genera JSON {"metaTitle", "metaDescription"} para la HOME.
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

// 4. Metadata Imagen (CON VISIÓN)
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo, imageBuffer) => {
    const prompt = `
        Analiza esta imagen visualmente.
        Contexto: Foto de "${componente}" (${tipo}) en "${propiedad}".
        
        1. altText: Describe lo que ves (colores, luz, muebles) para SEO. Máx 125 chars.
        2. title: Título corto. Máx 60 chars.

        Respuesta SOLO JSON {"altText": "...", "title": "..."}.
    `;
    try {
        // Pasamos el buffer para que el modelo 2.5 lo "vea"
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        return JSON.parse(raw);
    } catch (e) {
        console.warn("Fallo generación metadata imagen:", e);
        return { altText: `${componente} en ${propiedad}`, title: componente };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage
};