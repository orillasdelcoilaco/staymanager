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
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null;

// --- Función Placeholder (Sin cambios) ---
async function llamarIASimulada(prompt) {
    console.log("--- Llamando a IA (Simulado por falta de API Key o error) ---");
    // ... (código existente simulado sin cambios)
    if (prompt.includes("generar una descripción SEO para la propiedad")) {
        const propiedadMatch = prompt.match(/Alojamiento Específico: "(.*?)"/); // Corregido para prompt real
        const ubicacionMatch = prompt.match(/Ubicación General del Negocio: "(.*?)"/); // Corregido para prompt real
        const nombreAlojamiento = propiedadMatch ? propiedadMatch[1] : 'el alojamiento';
        const ubicacionTexto = ubicacionMatch ? ` en ${ubicacionMatch[1]}` : '';
        return `(SIMULADO) Descubre tu escapada ideal${ubicacionTexto}. Confort, naturaleza y tinaja privada. Perfecto para ${prompt.includes('familiar') ? 'familias' : 'parejas'}. ¡Reserva ahora en ${prompt.match(/Empresa: "(.*?)"/)[1]}!`; // No empezar con el nombre
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
    // ... (sin cambios)
    if (!model) {
        console.warn("Llamando a IA Simulada (Falta API Key o inicialización falló)");
        return llamarIASimulada(prompt);
    }
    try {
        console.log(`[AI Service] Enviando prompt al modelo ${model.model}...`);
        // console.log("Prompt:", prompt); // Descomentar para depurar el prompt exacto
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = '';
        try {
            text = response.text();
        } catch (textError) {
             console.warn("[AI Service] La respuesta de Gemini API no contenía texto directo. Usando respuesta simulada.");
             return llamarIASimulada(prompt);
        }
        console.log("[AI Service] Respuesta de Gemini API recibida.");
        // console.log("Respuesta:", text); // Descomentar para ver respuesta cruda
        return text;
    } catch (error) {
        console.error("Error detallado al llamar a Gemini API:", error);
        console.warn("Usando respuesta simulada debido a error de API.");
        return llamarIASimulada(prompt);
    }
}

// --- Funciones Home Page (Sin cambios) ---
const generarSeoHomePage = async (empresaData) => {
    // ... (código existente sin cambios)
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
        metadata.metaTitle = metadata.metaTitle.substring(0, 60);
        metadata.metaDescription = metadata.metaDescription.substring(0, 155);
        return metadata;
    } catch (error) {
        console.error("Error generando SEO Home Page:", error, "Respuesta IA:", respuestaIA);
        return {
            metaTitle: `${empresaData.tipoAlojamientoPrincipal || 'Alojamientos'} en ${empresaData.ubicacionTexto || 'Destino'} | ${empresaData.nombre}`,
            metaDescription: `Reserva ${empresaData.tipoAlojamientoPrincipal || 'alojamientos'} directamente en ${empresaData.ubicacionTexto || 'nuestro destino'}. Ideal para ${empresaData.enfoqueMarketing || 'tus vacaciones'}. ¡Consulta disponibilidad!`
        };
    }
};
const generarContenidoHomePage = async (empresaData) => {
    // ... (código existente sin cambios)
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
        return {
            h1: `${empresaData.tipoAlojamientoPrincipal || 'Alojamientos'} en ${empresaData.ubicacionTexto || 'Nuestro Destino'}`,
            introParagraph: `Bienvenido a ${empresaData.nombre}. Descubre nuestros ${empresaData.tipoAlojamientoPrincipal || 'alojamientos'} en ${empresaData.ubicacionTexto || 'un lugar especial'}, ideales para ${empresaData.enfoqueMarketing || 'escapadas'}. ¡Encuentra tu opción perfecta y reserva!`
        };
    }
};

// Genera Descripción Optimizada para una Propiedad Específica (PROMPT MODIFICADO)
const generarDescripcionAlojamiento = async (descripcionManual, nombreAlojamiento, nombreEmpresa, ubicacionEmpresa, tipoAlojamientoEmpresa, enfoqueMarketingEmpresa) => {
    // *** INICIO PROMPT MODIFICADO ***
    const prompt = `
        Eres un experto en SEO copywriting para la industria del turismo. Tu objetivo es generar una descripción ALTAMENTE OPTIMIZADA, natural y atractiva para una propiedad específica llamada "${nombreAlojamiento}", que pertenece a la empresa "${nombreEmpresa}".

        Contexto General (Empresa):
        - Ubicación General del Negocio: "${ubicacionEmpresa || '(Ubicación no especificada)'}" (Ej: Pucón, Araucanía, Chile)
        - Tipo Principal de Alojamientos: "${tipoAlojamientoEmpresa || 'alojamientos'}"
        - Enfoque General de Marketing: "${enfoqueMarketingEmpresa || 'vacaciones'}"

        Contexto Específico (Propiedad):
        - Nombre del Alojamiento: "${nombreAlojamiento}"
        - Descripción base manual (si la hay): "${descripcionManual || '(No proporcionada)'}"

        Instrucciones Clave:
        1.  **NO Repetir Nombre:** NO comiences la descripción repitiendo "${nombreAlojamiento}". El título ya lo indica. Empieza directamente describiendo la experiencia o beneficio principal.
        2.  **Enfoque en la Propiedad:** Describe ESTA propiedad específica, sus características únicas y beneficios. Usa la descripción manual como inspiración si existe, pero reescríbela para que sea más fluida y persuasiva.
        3.  **Ubicación Natural:** Menciona la UBICACIÓN GENERAL del negocio (ej: "disfruta Pucón", "tu base en la Araucanía") UNA SOLA VEZ y de forma natural, integrada en la descripción. NO uses frases como "en Ubicación [Nombre Ubicación]". Usa el nombre de la ciudad o zona principal proporcionada.
        4.  **Keywords Relevantes:** Integra sutilmente keywords como: ${tipoAlojamientoEmpresa || 'alojamiento'}, arriendo, vacaciones, escapada, ${ubicacionEmpresa ? ubicacionEmpresa.split(',')[0].trim() : ''}. Adapta al tipo real (cabaña, departamento).
        5.  **Beneficios Claros:** Destaca QUÉ GANA el huésped (relax, vistas, comodidad, tinaja, parrilla, cercanía a atracciones). Evita simplemente listar características.
        6.  **Llamada a la Acción (Sutil):** Anima a la reserva directa (ej: "ideal para tu próxima visita a [Ubicación]", "reserva tu estancia con nosotros en ${nombreEmpresa}").
        7.  **Estilo:** Tono cálido, acogedor y persuasivo. Usa frases cortas y párrafos breves (máximo 2-3 párrafos en total). Evita la repetición excesiva de la ubicación regional.
        8.  **Formato:** SOLO texto plano. SIN markdown (*, #), SIN títulos o encabezados.

        Genera la descripción optimizada para "${nombreAlojamiento}".
    `;
    // *** FIN PROMPT MODIFICADO ***
    const respuestaIA = await llamarGeminiAPI(prompt);
    // Limpieza adicional por si acaso
    return respuestaIA
        .replace(/^[\*#\s]+|[\*#\s]+$/g, '') // Quita markdown al inicio/fin
        .replace(/^.*?\bes\b\s*/i, '') // Intenta quitar frases iniciales como "Cabaña 9 es..."
        .trim();
};


// Genera Alt Text y Title para una Imagen (sin cambios)
const generarMetadataImagen = async (nombreEmpresa, nombrePropiedad, descripcionPropiedad, nombreComponente, tipoComponente) => {
    // ... (código existente sin cambios)
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
    let respuestaIA = ''; // Definir fuera del try para el catch
    try {
        respuestaIA = await llamarGeminiAPI(prompt);
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Respuesta IA no contenía JSON.");
        let metadata = JSON.parse(jsonMatch[0]);
        if (!metadata.altText || !metadata.title) throw new Error("JSON incompleto.");
        metadata.altText = metadata.altText.substring(0, 120).trim();
        metadata.title = metadata.title.substring(0, 80).trim();
        console.log("[AI Service] Metadata generada:", metadata);
        return metadata;
    } catch (error) {
        console.error("Error al generar/parsear metadata de imagen con IA:", error, "Respuesta IA:", respuestaIA);
        return {
            altText: `Imagen de ${nombreComponente} en ${nombrePropiedad}, ${nombreEmpresa}`.substring(0, 120),
            title: `${nombreComponente} - ${nombrePropiedad}`.substring(0, 80)
        };
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage
};