// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.RENDER) {
    require('dotenv').config();
}

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("¡ADVERTENCIA! No se encontró GEMINI_API_KEY.");
}

// Usamos gemini-1.5-flash que es el estándar actual rápido/económico
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

// --- Función Placeholder Profesional (Sin etiquetas feas) ---
async function llamarIASimulada(prompt) {
    console.log("--- Usando respuesta de respaldo (Fallback) ---");
    
    if (prompt.includes("generar una descripción SEO para la propiedad")) {
        return "Disfruta de una estancia inolvidable en nuestro alojamiento. Ubicación privilegiada, comodidades excepcionales y el ambiente perfecto para tu descanso. ¡Reserva tu escapada ideal hoy mismo!";
    } else if (prompt.includes("generar metadatos (alt text y title)")) {
        return JSON.stringify({ 
            altText: "Vista del alojamiento turístico destacando sus comodidades", 
            title: "Alojamiento Turístico" 
        });
    } else if (prompt.includes("generar metadatos SEO para la PÁGINA DE INICIO")) {
        return JSON.stringify({ 
            metaTitle: "Reservas de Cabañas y Alojamientos | Mejor Precio Garantizado", 
            metaDescription: "Encuentra y reserva tu alojamiento ideal. Disfruta de la naturaleza y el confort con la mejor tarifa directa. ¡Consulta disponibilidad ahora!" 
        });
    } else if (prompt.includes("generar el contenido principal para la PÁGINA DE INICIO")) {
        return JSON.stringify({ 
            h1: "Bienvenidos a Su Destino Ideal de Descanso", 
            introParagraph: "Descubra nuestros alojamientos únicos, diseñados para brindarle la máxima comodidad y tranquilidad. Ya sea una escapada romántica o unas vacaciones familiares, tenemos el espacio perfecto para usted." 
        });
    }
    return "Contenido generado automáticamente.";
}

async function llamarGeminiAPI(prompt) {
    if (!model) return llamarIASimulada(prompt);
    
    try {
        console.log(`[AI Service] Enviando prompt a Gemini...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        if (!text) throw new Error("Respuesta vacía");
        
        // Limpiar bloques de código Markdown si la IA los añade
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return text;
    } catch (error) {
        console.error("Error Gemini API:", error.message);
        return llamarIASimulada(prompt);
    }
}

// 1. SEO Home Page
const generarSeoHomePage = async (empresaData) => {
    const prompt = `
        Actúa como experto SEO. Genera JSON {"metaTitle", "metaDescription"} para la HOME de turismo.
        Empresa: "${empresaData.nombre}", Ubicación: "${empresaData.ubicacionTexto || ''}".
        
        1. metaTitle: Máx 60 caracteres. Atractivo.
        2. metaDescription: Máx 155 caracteres. Persuasivo.
        
        Respuesta SOLO JSON válido.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        const json = JSON.parse(raw);
        return {
            metaTitle: json.metaTitle?.substring(0, 60) || "Título Pendiente",
            metaDescription: json.metaDescription?.substring(0, 155) || "Descripción pendiente."
        };
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar metadatos SEO para la PÁGINA DE INICIO"));
    }
};

// 2. Contenido Home Page
const generarContenidoHomePage = async (empresaData) => {
    const prompt = `
        Actúa como Copywriter. Genera JSON {"h1", "introParagraph"} para HOME turismo.
        Empresa: "${empresaData.nombre}".
        
        1. h1: Título principal H1 optimizado (máx 70 chars).
        2. introParagraph: Bienvenida cálida y venta de valor (2-3 frases).
        
        Respuesta SOLO JSON válido.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar el contenido principal para la PÁGINA DE INICIO"));
    }
};

// 3. Descripción Alojamiento
const generarDescripcionAlojamiento = async (descManual, nombre, empresa, ubicacion, tipo, marketing) => {
    const prompt = `
        Mejora esta descripción para un ${tipo} llamado "${nombre}" en ${ubicacion}.
        Base: "${descManual || ''}".
        Enfoque: ${marketing}.
        
        Salida: Texto plano persuasivo (sin markdown), máx 150 palabras.
    `;
    return await llamarGeminiAPI(prompt);
};

// 4. Metadata Imagen
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo) => {
    const prompt = `
        Genera JSON {"altText", "title"} para imagen de ${componente} (${tipo}) en ${propiedad}.
        Contexto: ${desc}.
        
        1. altText: Descriptivo para SEO (máx 120 chars).
        2. title: Corto para tooltip (máx 80 chars).
        
        Respuesta SOLO JSON válido.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar metadatos (alt text y title)"));
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage
};