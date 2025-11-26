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
    // ... (logica fallback existente)
    return JSON.stringify({ altText: "Imagen procesada", title: "Imagen", advertencia: null });
}

async function llamarGeminiAPI(prompt, imageBuffer = null) {
    if (!model) return llamarIASimulada(prompt);
    
    try {
        let result;
        if (imageBuffer) {
            console.log(`[AI Service] 👁️ PROCESANDO IMAGEN CON VISIÓN (${model.model})...`);
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp"
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            console.log(`[AI Service] 📝 Procesando solo texto...`);
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        let text = response.text();
        return text.replace(/```json/g, '').replace(/```/g, '').trim();
    } catch (error) {
        console.error("Error Gemini API:", error.message);
        return llamarIASimulada(prompt);
    }
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
        Actúa como un Auditor de Calidad Visual para hoteles.
        
        ESTÁS VIENDO: Una foto subida por el usuario para el espacio: "${componente}" (Tipo esperado: ${tipo}).
        PROPIEDAD: "${propiedad}".

        TAREAS:
        1. Describe qué ves realmente en la foto (altText).
        2. Evalúa si la foto COINCIDE con el tipo de espacio "${tipo}".
           - Si suben un baño y el espacio es "Dormitorio": DETECTARLO.
           - Si suben un paisaje y el espacio es "Cocina": DETECTARLO.
           - Si la foto es borrosa, oscura o de mala calidad: DETECTARLO.

        Responde SOLO JSON:
        {
            "altText": "Descripción visual detallada para SEO (máx 120 chars)",
            "title": "Título corto y atractivo (máx 60 chars)",
            "advertencia": "Si la foto NO corresponde al espacio o es mala, escribe aquí una advertencia corta al usuario. Si está bien, pon null."
        }
    `;
    
    try {
        // Es CRÍTICO pasar el imageBuffer aquí
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const json = JSON.parse(raw);
        return json;
    } catch (e) {
        console.warn("Fallo IA Visión:", e);
        return { altText: `${componente} en ${propiedad}`, title: componente, advertencia: null };
    }
};

module.exports = {
    // ... exportar las mismas funciones de antes ...
    generarSeoHomePage: require('./aiContentService').generarSeoHomePage, // Truco si no quieres copiar todo, pero mejor copia el archivo completo o mantén las funciones anteriores
    generarContenidoHomePage: require('./aiContentService').generarContenidoHomePage,
    generarDescripcionAlojamiento: require('./aiContentService').generarDescripcionAlojamiento,
    generarMetadataImagen
};