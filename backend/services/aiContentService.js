// backend/services/aiContentService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Cargar dotenv solo si no estamos en producción
if (!process.env.RENDER) {
    require('dotenv').config();
}

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("¡ADVERTENCIA! No se encontró GEMINI_API_KEY.");
}

// Usamos gemini-1.5-flash por ser el estándar actual de velocidad/calidad
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({  model: "models/gemini-2.5-flash" }) : null;

// --- Función Placeholder (Respaldo) ---
async function llamarIASimulada(prompt) {
    console.log("--- Usando respuesta de respaldo (Fallback) ---");
    // Respuestas genéricas pero profesionales si falla la API
    if (prompt.includes("generar metadatos SEO")) {
        return JSON.stringify({ 
            metaTitle: "Alojamiento Turístico | Reserva Directa al Mejor Precio", 
            metaDescription: "Reserva tu estancia directamente con nosotros. Mejor tarifa garantizada, confirmación inmediata y atención personalizada." 
        });
    } else if (prompt.includes("generar el contenido principal")) {
        return JSON.stringify({ 
            h1: "Bienvenidos a Nuestro Alojamiento", 
            introParagraph: "Disfruta de una experiencia única con todas las comodidades. Ubicación ideal para tu descanso y desconexión." 
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
        
        // Limpieza agresiva de bloques de código Markdown que la IA a veces añade
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return text;
    } catch (error) {
        console.error("Error Gemini API:", error.message);
        return llamarIASimulada(prompt);
    }
}

// 1. SEO Home Page (Optimizada para Google Hotels/Local)
const generarSeoHomePage = async (empresaData) => {
    // Extraemos datos ricos para el prompt
    const nombre = empresaData.nombre || "Nuestra Empresa";
    const ubicacion = empresaData.ubicacionTexto || "Chile";
    const tipo = empresaData.tipoAlojamientoPrincipal || "Alojamientos";
    const keywords = empresaData.palabrasClaveAdicionales || "reserva directa, sin comisiones";

    const prompt = `
        Actúa como un estratega SEO Senior especializado en hotelería y Google Hotels.
        Genera un objeto JSON con "metaTitle" y "metaDescription" para la página de inicio (Home).

        DATOS OBLIGATORIOS A INCLUIR:
        - Nombre de Marca: "${nombre}"
        - Ubicación Clave: "${ubicacion}"
        - Palabra Clave Principal: "${tipo}"
        - Extras: "${keywords}"

        REGLAS ESTRICTAS:
        1. **metaTitle** (Máx 60 chars): Estructura recomendada: "[Tipo] en [Ubicación] | [Nombre Marca]". Debe ser potente y local.
        2. **metaDescription** (Máx 155 chars): Debe comenzar con un verbo de acción (Reserva, Descubre, Vive). DEBE mencionar que es "Reserva Directa" o "Sin Comisiones" (clave para competir con OTAs). Incluye el nombre de la empresa.

        Salida: SOLO JSON válido {"metaTitle": "...", "metaDescription": "..."}.
    `;

    try {
        const raw = await llamarGeminiAPI(prompt);
        const json = JSON.parse(raw);
        return {
            metaTitle: json.metaTitle?.substring(0, 60) || `${tipo} en ${ubicacion} | ${nombre}`,
            metaDescription: json.metaDescription?.substring(0, 155) || `Reserva directa en ${nombre}. Los mejores ${tipo} en ${ubicacion}.`
        };
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar metadatos SEO"));
    }
};

// 2. Contenido Home Page (Copywriting Persuasivo)
const generarContenidoHomePage = async (empresaData) => {
    const nombre = empresaData.nombre || "";
    const ubicacion = empresaData.ubicacionTexto || "";
    const tipo = empresaData.tipoAlojamientoPrincipal || "alojamientos";
    const marketing = empresaData.enfoqueMarketing || "descanso y desconexión";

    const prompt = `
        Actúa como un Copywriter experto en conversión web para hoteles.
        Genera un objeto JSON con "h1" y "introParagraph" para la portada.

        DATOS:
        - Empresa: "${nombre}"
        - Ubicación: "${ubicacion}"
        - Servicio: "${tipo}"
        - Promesa de Valor: "${marketing}"

        REGLAS:
        1. **h1** (Título Principal): No pongas solo "Bienvenidos". Usa una frase con keywords. Ej: "Arriendo de [Tipo] en [Ubicación]" o "Tu refugio de [Marketing] en [Ubicación]". Máx 70 caracteres.
        2. **introParagraph**: 2 o 3 frases cortas. Menciona explícitamente a "${nombre}". Destaca la ubicación y el beneficio principal (${marketing}). Termina invitando a ver las opciones.

        Salida: SOLO JSON válido {"h1": "...", "introParagraph": "..."}.
    `;

    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar el contenido principal"));
    }
};

// 3. Descripción Alojamiento (Detallada y Específica)
const generarDescripcionAlojamiento = async (descManual, nombreAlojamiento, nombreEmpresa, ubicacion, tipo, marketing) => {
    const prompt = `
        Mejora la descripción comercial para la propiedad "${nombreAlojamiento}" de la empresa "${nombreEmpresa}".
        
        Contexto SEO:
        - Ubicación: ${ubicacion}
        - Tipo: ${tipo}
        - Enfoque: ${marketing}
        - Borrador manual: "${descManual || ''}"

        Instrucciones:
        - Redacta un texto atractivo de 2 párrafos (máx 150 palabras en total).
        - **Primer párrafo**: Gancho emocional centrado en la experiencia en "${ubicacion}". Usa el nombre de la propiedad.
        - **Segundo párrafo**: Detalles prácticos y comodidades, cerrando con una invitación a reservar directo.
        - Usa palabras clave de cola larga (long-tail) relacionadas con "${tipo} en ${ubicacion}".
        - NO uses Markdown, solo texto plano.
    `;
    return await llamarGeminiAPI(prompt);
};

// 4. Metadata Imagen (SEO de Imágenes)
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo) => {
    const prompt = `
        Genera metadatos SEO (JSON) para una foto de: "${componente}" (Tipo: ${tipo}) en la propiedad "${propiedad}" de "${empresa}".
        
        REGLAS:
        1. **altText** (SEO): Describe la imagen incluyendo palabras clave. Ej: "Dormitorio matrimonial con vista al bosque en Cabaña X, Pucón". (Máx 120 chars).
        2. **title** (Tooltip): Nombre corto y descriptivo. Ej: "Dormitorio Principal - ${propiedad}". (Máx 80 chars).

        Salida: SOLO JSON válido {"altText": "...", "title": "..."}.
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return { altText: `${componente} en ${propiedad}`, title: componente };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage
};