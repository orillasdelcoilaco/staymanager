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
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null; // Mantener el modelo que funciona

// --- Función Placeholder (Mantenida por si falla la API) ---
async function llamarIASimulada(prompt) {
    console.log("--- Llamando a IA (Simulado por falta de API Key o error) ---");
    if (prompt.includes("generar una descripción SEO para la propiedad")) {
        const propiedadMatch = prompt.match(/Alojamiento: "(.*?)"/);
        const ubicacionMatch = prompt.match(/Ubicación: (.*?),/);
        const nombreAlojamiento = propiedadMatch ? propiedadMatch[1] : 'el alojamiento';
        const ubicacionTexto = ubicacionMatch ? ` en ${ubicacionMatch[1]}` : '';
        return `(SIMULADO) Descubre ${nombreAlojamiento}${ubicacionTexto}, tu escapada ideal. Confort, naturaleza y tinaja privada. Perfecto para familias. ¡Reserva ahora!`;
    } else if (prompt.includes("generar metadatos (alt text y title)")) {
        const altText = `(SIMULADO) Detalle interior de la propiedad.`;
        const titleText = `(SIMULADO) Detalle Alojamiento`;
        return JSON.stringify({ altText: altText.substring(0,120), title: titleText.substring(0,80) });
    } else if (prompt.includes("generar metadatos SEO para la PÁGINA DE INICIO")) {
        const metaTitle = `(SIMULADO) Cabañas en [Ubicación] | Reserva Directa | [Nombre Empresa]`;
        const metaDescription = `(SIMULADO) Encuentra las mejores cabañas en [Ubicación]. Reserva directa sin comisiones. Naturaleza, descanso y comodidad. ¡Consulta disponibilidad!`;
        return JSON.stringify({ metaTitle: metaTitle.substring(0, 60), metaDescription: metaDescription.substring(0, 155) });
    } else if (prompt.includes("generar el contenido principal para la PÁGINA DE INICIO")) {
        const h1 = `(SIMULADO) Alquiler de Cabañas en [Ubicación Principal]`;
        const introParagraph = `(SIMULADO) Bienvenido a [Nombre Empresa], tu destino ideal para disfrutar de la naturaleza y el descanso en [Ubicación Principal]. Ofrecemos [Tipo Alojamiento Principal] perfectas para [Enfoque Marketing]. Explora nuestras opciones y reserva tu próxima escapada.`;
        return JSON.stringify({ h1: h1, introParagraph: introParagraph });
    }
    return "(SIMULADO) Respuesta genérica de IA.";
}
// --- Fin Placeholder ---

async function llamarGeminiAPI(prompt) {
    if (!model) {
        console.warn("Llamando a IA Simulada (Falta API Key o inicialización falló)");
        return llamarIASimulada(prompt);
    }
    try {
        console.log(`[AI Service] Enviando prompt al modelo ${model.model}...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        // Intenta obtener texto, maneja posible error si la respuesta no es texto
        let text = '';
        try {
            text = response.text();
        } catch (textError) {
             console.warn("[AI Service] La respuesta de Gemini API no contenía texto directo. Usando respuesta simulada.");
             return llamarIASimulada(prompt); // Fallback si no hay texto
        }
        console.log("[AI Service] Respuesta de Gemini API recibida.");
        return text;
    } catch (error) {
        console.error("Error detallado al llamar a Gemini API:", error);
        console.warn("Usando respuesta simulada debido a error de API.");
        return llamarIASimulada(prompt);
    }
}

// Genera Meta Título y Meta Descripción para la Página de Inicio
const generarSeoHomePage = async (empresaData) => {
    const prompt = `
        Eres un experto SEO para sitios web de turismo, especializado en reservas directas.
        Genera metadatos SEO OPTIMIZADOS para la PÁGINA DE INICIO de un negocio de arriendos turísticos.

        Contexto de la Empresa:
        - Nombre: "${empresaData.nombre}"
        - Ubicación Principal: "${empresaData.ubicacionTexto || '(Ubicación no especificada)'}"
        - Tipo Principal Alojamiento: "${empresaData.tipoAlojamientoPrincipal || 'alojamientos'}"
        - Palabras Clave Adicionales: "${empresaData.palabrasClaveAdicionales || ''}"
        - Enfoque Marketing: "${empresaData.enfoqueMarketing || ''}"

        Instrucciones:
        1.  **metaTitle:** Crea un título atractivo y conciso (máx. 60 caracteres). DEBE incluir el nombre de la empresa, la ubicación principal y el tipo de alojamiento. Ejemplo: "Cabañas en Pucón | Reserva Directa | Cabañas Los Robles".
        2.  **metaDescription:** Escribe una descripción persuasiva (máx. 155 caracteres) que invite al clic. Incluye palabras clave relevantes (ubicación, tipo alojamiento, reserva directa, beneficios como 'descanso', 'naturaleza') y un llamado a la acción claro.

        Respuesta: SOLO un objeto JSON válido {"metaTitle": "...", "metaDescription": "..."} sin saltos de línea, markdown o texto explicativo adicional. Asegúrate de cumplir los límites de caracteres.
    `;
    try {
        const respuestaIA = await llamarGeminiAPI(prompt);
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Respuesta IA no contenía JSON.");
        const metadata = JSON.parse(jsonMatch[0]);
        if (!metadata.metaTitle || !metadata.metaDescription) throw new Error("JSON incompleto.");
        // Asegurar límites
        metadata.metaTitle = metadata.metaTitle.substring(0, 60);
        metadata.metaDescription = metadata.metaDescription.substring(0, 155);
        return metadata;
    } catch (error) {
        console.error("Error generando SEO Home Page:", error, "Respuesta IA:", respuestaIA);
        // Fallback robusto
        return {
            metaTitle: `${empresaData.tipoAlojamientoPrincipal || 'Alojamientos'} en ${empresaData.ubicacionTexto || 'Destino'} | ${empresaData.nombre}`,
            metaDescription: `Reserva ${empresaData.tipoAlojamientoPrincipal || 'alojamientos'} directamente en ${empresaData.ubicacionTexto || 'nuestro destino'}. Ideal para ${empresaData.enfoqueMarketing || 'tus vacaciones'}. ¡Consulta disponibilidad!`
        };
    }
};

// Genera H1 y Párrafo Introductorio para la Página de Inicio
const generarContenidoHomePage = async (empresaData) => {
    const prompt = `
        Eres un copywriter experto en turismo, creando contenido atractivo y optimizado para SEO para la PÁGINA DE INICIO de un sitio de reservas directas.

        Contexto de la Empresa:
        - Nombre: "${empresaData.nombre}"
        - Ubicación Principal: "${empresaData.ubicacionTexto || '(Ubicación no especificada)'}"
        - Tipo Principal Alojamiento: "${empresaData.tipoAlojamientoPrincipal || 'alojamientos turísticos'}"
        - Slogan: "${empresaData.slogan || ''}"
        - Palabras Clave Adicionales: "${empresaData.palabrasClaveAdicionales || ''}"
        - Enfoque Marketing: "${empresaData.enfoqueMarketing || 'todo tipo de viajeros'}"

        Instrucciones:
        1.  **h1:** Crea un título H1 impactante y optimizado para SEO local (máx. 70 caracteres). DEBE incluir el tipo de alojamiento y la ubicación principal. Ejemplo: "Alquiler de Cabañas Premium en Pucón".
        2.  **introParagraph:** Escribe un párrafo introductorio (2-3 frases cortas) que dé la bienvenida, presente la propuesta de valor (usando el enfoque y tipo de alojamiento), mencione la ubicación y anime a explorar o reservar. Integra palabras clave naturalmente.

        Respuesta: SOLO un objeto JSON válido {"h1": "...", "introParagraph": "..."} sin saltos de línea, markdown o texto explicativo adicional.
    `;
     try {
        const respuestaIA = await llamarGeminiAPI(prompt);
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Respuesta IA no contenía JSON.");
        const content = JSON.parse(jsonMatch[0]);
        if (!content.h1 || !content.introParagraph) throw new Error("JSON incompleto.");
        return content;
    } catch (error) {
        console.error("Error generando Contenido Home Page:", error, "Respuesta IA:", respuestaIA);
        // Fallback robusto
        return {
            h1: `${empresaData.tipoAlojamientoPrincipal || 'Alojamientos'} en ${empresaData.ubicacionTexto || 'Nuestro Destino'}`,
            introParagraph: `Bienvenido a ${empresaData.nombre}. Descubre nuestros ${empresaData.tipoAlojamientoPrincipal || 'alojamientos'} en ${empresaData.ubicacionTexto || 'un lugar especial'}, ideales para ${empresaData.enfoqueMarketing || 'escapadas'}. ¡Encuentra tu opción perfecta y reserva!`
        };
    }
};

// Genera Descripción Optimizada para una Propiedad Específica
const generarDescripcionAlojamiento = async (descripcionManual, nombreAlojamiento, nombreEmpresa, ubicacionEmpresa, tipoAlojamientoEmpresa, enfoqueMarketingEmpresa) => {
    const prompt = `
        Eres un experto en SEO copywriting para la industria del turismo. Tu objetivo es generar una descripción ALTAMENTE OPTIMIZADA y atractiva para una propiedad específica dentro de un sitio de reservas directas. Usa la descripción manual como base si existe, pero prioriza el SEO y la persuasión.

        Contexto:
        - Alojamiento Específico: "${nombreAlojamiento}"
        - Empresa: "${nombreEmpresa}"
        - Ubicación General del Negocio: "${ubicacionEmpresa || '(Ubicación no proporcionada)'}"
        - Tipo Principal de Alojamientos de la Empresa: "${tipoAlojamientoEmpresa || 'alojamientos'}"
        - Enfoque General de Marketing: "${enfoqueMarketingEmpresa || ''}"
        - Descripción base manual (si la hay): "${descripcionManual || '(No proporcionada)'}"

        Instrucciones Clave:
        1.  **Enfoque en la Propiedad:** Describe ESTA propiedad específica, sus características únicas y beneficios.
        2.  **SEO Local:** Integra natural y prominentemente la UBICACIÓN GENERAL del negocio (ej. "disfruta Pucón desde nuestra cabaña", "alojamiento en la Araucanía").
        3.  **Keywords Relevantes:** Incluye keywords principales como: ${tipoAlojamientoEmpresa || 'alojamiento'}, arriendo, vacaciones, escapada, ${ubicacionEmpresa ? ubicacionEmpresa.split(',')[0] : ''}. Adapta según el tipo real de propiedad (cabaña, departamento, etc.).
        4.  **Beneficios Claros:** Destaca QUÉ GANA el huésped al elegir ESTA propiedad (relax, vistas, comodidad, privacidad, cercanía a X).
        5.  **Llamada a la Acción (Sutil):** Anima a la reserva directa (ej: "ideal para tu próxima visita a [Ubicación]", "reserva tu estancia con nosotros").
        6.  **Estilo:** Persuasivo, conciso (máximo 2 párrafos cortos), fácil de leer.
        7.  **Formato:** SOLO texto plano. SIN markdown (*, #), SIN títulos o encabezados.

        Genera la descripción optimizada para "${nombreAlojamiento}". Asegúrate que la ubicación y los beneficios específicos sean centrales.
    `;
    const respuestaIA = await llamarGeminiAPI(prompt);
    return respuestaIA.replace(/^[\*#\s]+|[\*#\s]+$/g, '').trim();
};

// Genera Alt Text y Title para una Imagen
const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente) => {
    const prompt = `
        Eres un experto en SEO de imágenes (SuiteManager Helper). Genera metadatos JSON para una imagen.
        Contexto:
        - Empresa: ${nombreEmpresa}
        - Alojamiento: ${nombrePropiedad}
        - Componente: ${nombreComponente} (Tipo: ${tipoComponente})
        - Descripción Alojamiento: ${descripcionPropiedad || 'Alojamiento turístico.'}

        Instrucciones:
        1.  **altText:** Describe la imagen de forma concisa y útil para accesibilidad y SEO (máx 120 caracteres). Incluye qué se ve, el nombre del componente/alojamiento, la empresa y la ubicación si es relevante. (Ej: "Luminoso dormitorio principal con cama king en Cabaña El Roble de ${nombreEmpresa}, Pucón")
        2.  **title:** Texto corto para tooltip (máx 80 caracteres), enfocado en el sujeto principal. (Ej: "Dormitorio Principal - Cabaña El Roble")

        Respuesta: SOLO un objeto JSON válido {"altText": "...", "title": "..."} sin saltos de línea, markdown o texto explicativo adicional. Asegúrate de escapar comillas dobles dentro de los strings si es necesario y de cumplir los límites de caracteres.
    `;
    try {
        const respuestaIA = await llamarGeminiAPI(prompt);
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Respuesta IA no contenía JSON.");
        let metadata = JSON.parse(jsonMatch[0]);
        if (!metadata.altText || !metadata.title) throw new Error("JSON incompleto.");
        // Asegurar límites estrictos
        metadata.altText = metadata.altText.substring(0, 120).trim();
        metadata.title = metadata.title.substring(0, 80).trim();
        console.log("[AI Service] Metadata generada:", metadata);
        return metadata;
    } catch (error) {
        console.error("Error al generar/parsear metadata de imagen con IA:", error, "Respuesta IA:", respuestaIA);
        // Fallback robusto
        return {
            altText: `Imagen de ${nombreComponente} en ${nombrePropiedad}, ${nombreEmpresa}`.substring(0, 120),
            title: `${nombreComponente} - ${nombrePropiedad}`.substring(0, 80)
        };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage, // Nueva función
    generarContenidoHomePage // Nueva función
};