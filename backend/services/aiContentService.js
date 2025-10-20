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
// **CAMBIO:** Volver a inicializar directamente con 'gemini-pro'
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-pro" }) : null;

// --- Función Placeholder (Mantenida por si falla la API) ---
async function llamarIASimulada(prompt) {
    console.log("--- Llamando a IA (Simulado por falta de API Key o error) ---");
    // Mensaje simulado, puedes ajustarlo si necesitas algo más específico
    if (prompt.includes("generar una descripción SEO")) {
        return `(SIMULADO) Descripción SEO atractiva y optimizada para el alojamiento, destacando características únicas y beneficios para el descanso y la naturaleza. Ideal para atraer visitantes.`;
    } else if (prompt.includes("generar metadatos (alt text y title)")) {
        // Extraer contexto del prompt para simulación más realista
        const empresaMatch = prompt.match(/Empresa: (.*)/);
        const propiedadMatch = prompt.match(/Alojamiento: (.*)/);
        const componenteMatch = prompt.match(/Componente: (.*) \(Tipo: (.*)\)/);
        const altText = `(SIMULADO) Foto detallada de ${componenteMatch ? componenteMatch[1] : 'la habitación'} en ${propiedadMatch ? propiedadMatch[1] : 'el alojamiento'} de ${empresaMatch ? empresaMatch[1] : 'la empresa'}.`;
        const titleText = `(SIMULADO) ${componenteMatch ? componenteMatch[1] : 'Detalle'} - ${propiedadMatch ? propiedadMatch[1] : 'Alojamiento'}`;
        return JSON.stringify({ altText: altText.substring(0,120), title: titleText.substring(0,80) });
    }
    return "(SIMULADO) Respuesta genérica de IA.";
}
// --- Fin Placeholder ---

/**
 * Llama a la API de Gemini para generar contenido.
 * @param {string} prompt El prompt para la IA.
 * @returns {Promise<string>} La respuesta de texto de la IA.
 */
async function llamarGeminiAPI(prompt) {
    // Si no hay modelo (falta API key o falló la inicialización inicial)
    if (!model) {
        console.warn("Llamando a IA Simulada (Falta API Key o inicialización falló)");
        return llamarIASimulada(prompt);
    }
    try {
        console.log(`[AI Service] Enviando prompt al modelo ${model.model}...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("[AI Service] Respuesta de Gemini API recibida.");
        // console.log(text); // Descomentar para depurar la respuesta completa
        return text;
    } catch (error) {
        // Loguear el error completo para más detalles
        console.error("Error detallado al llamar a Gemini API:", error);
        console.warn("Usando respuesta simulada debido a error de API.");
        // Si la API falla, recurrir a la simulación
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
        Formato: Solo texto plano. NO incluyas markdown como '*' o '#'.
    `;

    const respuestaIA = await llamarGeminiAPI(prompt);
    // Limpiar posible markdown residual o texto introductorio innecesario
    return respuestaIA.replace(/^[\*#\s]+|[\*#\s]+$/g, '').trim(); // Limpieza más robusta
};

const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente) => {
    const prompt = `
        Eres un experto en SEO de imágenes (SuiteManager Helper). Genera metadatos JSON para una imagen.
        Contexto:
        - Empresa: ${nombreEmpresa}
        - Alojamiento: ${nombrePropiedad}
        - Componente: ${nombreComponente} (Tipo: ${tipoComponente})
        - Descripción Alojamiento: ${descripcionPropiedad || 'Alojamiento turístico.'}

        Instrucciones:
        1.  **altText:** Describe la imagen de forma concisa y útil para accesibilidad y SEO. Incluye qué se ve, el nombre del componente/alojamiento y la empresa. (Ej: "Moderno baño principal con ducha a ras de suelo en Cabaña El Roble de ${nombreEmpresa}")
        2.  **title:** Texto corto para tooltip, enfocado en el sujeto principal. (Ej: "Baño principal con ducha - Cabaña El Roble")

        Respuesta: SOLO un objeto JSON válido {"altText": "...", "title": "..."} sin saltos de línea, markdown o texto explicativo adicional. Asegúrate de escapar comillas dobles dentro de los strings si es necesario.
    `;

    try {
        const respuestaIA = await llamarGeminiAPI(prompt);
        // Intentar extraer el JSON de la respuesta de forma más robusta
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/); // Busca el primer '{' hasta el último '}'
        if (!jsonMatch) {
             console.error("Respuesta IA no contenía un objeto JSON:", respuestaIA);
             throw new Error("Respuesta IA no contenía JSON.");
        }

        let metadata;
        try {
            metadata = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error("Error al parsear JSON de IA:", parseError, "Respuesta recibida:", respuestaIA);
            throw new Error("JSON de IA inválido.");
        }

        if (!metadata.altText || !metadata.title || typeof metadata.altText !== 'string' || typeof metadata.title !== 'string') {
            console.error("JSON de IA incompleto o con tipos incorrectos:", metadata);
            throw new Error("JSON de IA incompleto o con tipos incorrectos.");
        }
        // Asegurarse de que no sean demasiado largos (opcional pero bueno)
        metadata.altText = metadata.altText.substring(0, 125).trim(); // Límite recomendado
        metadata.title = metadata.title.substring(0, 80).trim();

        console.log("[AI Service] Metadata generada:", metadata);
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