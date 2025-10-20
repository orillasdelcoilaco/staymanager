// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cargar dotenv solo si no estamos en producción (Render)
if (!process.env.RENDER) {
    require('dotenv').config();
}

// Acceder a la clave API desde las variables de entorno
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("¡ADVERTENCIA! No se encontró la GEMINI_API_KEY. Las funciones de IA usarán respuestas simuladas.");
}

// Inicializar el cliente (solo si hay API Key)
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
// **CAMBIO:** Usar un modelo más estable como 'gemini-pro' en lugar de 'gemini-1.5-flash'
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-pro" }) : null;

// --- Función Placeholder (Mantenida por si falla la API) ---
async function llamarIASimulada(prompt) {
    console.log("--- Llamando a IA (Simulado por falta de API Key o error) ---");
    // ... (resto de la función simulada como estaba antes) ...
    if (prompt.includes("generar una descripción SEO")) {
        return `(SIMULADO) Descripción SEO generada basada en prompt.`;
    } else if (prompt.includes("generar metadatos (alt text y title)")) {
        return JSON.stringify({ altText: "(SIMULADO) Alt text", title: "(SIMULADO) Title text" });
    }
    return "(SIMULADO) Respuesta IA.";
}
// --- Fin Placeholder ---

/**
 * Llama a la API de Gemini para generar contenido.
 * @param {string} prompt El prompt para la IA.
 * @returns {Promise<string>} La respuesta de texto de la IA.
 */
async function llamarGeminiAPI(prompt) {
    if (!model) {
        console.warn("Llamando a IA Simulada (Falta API Key o inicialización falló)");
        return llamarIASimulada(prompt); // Usar simulación si no hay API
    }
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("--- Respuesta de Gemini API ---");
        // console.log(text); // Descomentar para depurar la respuesta completa
        return text;
    } catch (error) {
        console.error("Error al llamar a Gemini API:", error);
        console.warn("Usando respuesta simulada debido a error de API.");
        // Si la API falla, recurrir a la simulación para no detener el flujo
        return llamarIASimulada(prompt);
    }
}


const generarDescripcionAlojamiento = async (descripcionActual, nombreAlojamiento, nombreEmpresa) => {
    const prompt = `
        Eres un experto en SEO para alojamientos turísticos llamado SuiteManager Helper.
        Genera una descripción SEO atractiva y optimizada para "${nombreAlojamiento}", de la empresa "${nombreEmpresa}".
        Descripción base actual: "${descripcionActual || '(No proporcionada)'}". Mejórala o créala si no existe.
        Destaca características únicas, beneficios y palabras clave (cabaña, descanso, naturaleza, etc.).
        Estilo: Persuasivo, conciso (máx 2 párrafos).
        Formato: Solo texto plano.
    `;

    // Usamos la nueva función que llama a la API real (o la simulada si falla)
    const respuestaIA = await llamarGeminiAPI(prompt);
    // Limpiar posible markdown residual o texto introductorio innecesario
    return respuestaIA.replace(/[*#`]/g, '').trim();
};

const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente) => {
    const prompt = `
        Eres un experto en SEO de imágenes (SuiteManager Helper). Genera metadatos JSON para una imagen.
        Contexto:
        - Empresa: ${nombreEmpresa}
        - Alojamiento: ${nombrePropiedad}
        - Componente: ${nombreComponente} (Tipo: ${tipoComponente})
        - Descripción Alojamiento: ${descripcionPropiedad}

        Instrucciones:
        1.  **altText:** Descriptivo, conciso, relevante. Incluir nombre componente, tipo, alojamiento/empresa. (Ej: "Baño principal moderno de Cabaña El Roble en ${nombreEmpresa}")
        2.  **title:** Similar o más corto, enfocado en el sujeto. (Ej: "Baño principal con ducha - Cabaña El Roble")

        Respuesta: SOLO un objeto JSON válido {"altText": "...", "title": "..."} sin saltos de línea ni markdown.
    `;

    try {
        const respuestaIA = await llamarGeminiAPI(prompt);
        // Intentar extraer el JSON de la respuesta
        const jsonMatch = respuestaIA.match(/\{.*\}/s);
        if (!jsonMatch) throw new Error("Respuesta IA no contenía JSON.");

        const metadata = JSON.parse(jsonMatch[0]);
        if (!metadata.altText || !metadata.title) {
            throw new Error("JSON de IA incompleto.");
        }
        // Asegurarse de que no sean demasiado largos (opcional)
        metadata.altText = metadata.altText.substring(0, 120);
        metadata.title = metadata.title.substring(0, 80);

        return metadata;
    } catch (error) {
        console.error("Error al generar/parsear metadata de imagen con IA:", error);
        // Fallback robusto
        return {
            altText: `Imagen de ${nombreComponente} en ${nombrePropiedad}, ${nombreEmpresa}`,
            title: `${nombreComponente} - ${nombrePropiedad}`
        };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen
};