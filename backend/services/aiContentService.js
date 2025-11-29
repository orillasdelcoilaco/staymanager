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
    } else if (prompt.includes("Estratega de Marca")) {
        return JSON.stringify({
            slogan: "Tu refugio ideal en la naturaleza (Simulado)",
            enfoqueMarketing: "Relax",
            palabrasClaveAdicionales: "alojamiento, turismo, descanso, naturaleza, simulado",
            tipoAlojamientoPrincipal: "Alojamiento Turístico (Simulado)",
            historiaOptimizada: "Esta es una historia optimizada simulada porque no se detectó la API Key de Gemini. Por favor configura GEMINI_API_KEY en el archivo .env para obtener resultados reales con IA.",
            heroAlt: "Vista del alojamiento simulada",
            heroTitle: "Alojamiento Simulado",
            homeSeoTitle: "Inicio | Alojamiento Simulado",
            homeSeoDesc: "Descripción simulada para SEO.",
            homeH1: "Bienvenido (Simulado)",
            homeIntro: "Introducción simulada."
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
const generarSeoHomePage = async (empresaData, contextoExtra = {}) => {
    const { historia, slogan, palabrasClave, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;

    const prompt = `
        Actúa como un Experto SEO Senior especializado en Turismo.
        Genera metadatos SEO de alto impacto para la PÁGINA DE INICIO (HOME) de este sitio web.

        INFORMACIÓN DE LA EMPRESA:
        - Nombre: "${empresaData.nombre}"
        - Ubicación: "${empresaData.ubicacionTexto || ''}"
        - Tipo de Alojamiento: "${tipoAlojamientoPrincipal || 'Alojamiento Turístico'}"
        - Historia/Identidad: "${historia || ''}"
        - Slogan: "${slogan || ''}"
        - Enfoque Marketing: "${enfoqueMarketing || ''}"
        - Palabras Clave Marca: "${palabrasClave || ''}"

        OBJETIVO:
        Generar un Título y una Descripción que maximicen el CTR en Google y reflejen la identidad de la marca.

        REQUISITOS:
        1. "metaTitle": Entre 50-60 caracteres. Debe incluir el nombre de la empresa y la palabra clave principal.
        2. "metaDescription": Entre 150-160 caracteres. Persuasiva, incluye ubicación y llamada a la acción implícita.

        Respuesta SOLO JSON válido:
        {
            "metaTitle": "...",
            "metaDescription": "..."
        }
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar metadatos SEO"));
    }
};

// 2. Contenido Home Page
const generarContenidoHomePage = async (empresaData, contextoExtra = {}) => {
    const { historia, slogan, palabrasClave, enfoqueMarketing, tipoAlojamientoPrincipal } = contextoExtra;

    const prompt = `
        Actúa como un Copywriter Web experto en Conversión (CRO).
        Genera el contenido principal (Above the Fold) para la HOME de este sitio web de turismo.

        INFORMACIÓN DE LA EMPRESA:
        - Nombre: "${empresaData.nombre}"
        - Slogan: "${slogan || ''}"
        - Historia/Esencia: "${historia || ''}"
        - Enfoque: "${enfoqueMarketing || ''}" (Ej: Relax, Aventura, Lujo)
        - Tipo: "${tipoAlojamientoPrincipal || ''}"

        TAREA:
        1. "h1": Un titular principal impactante. No solo el nombre de la empresa. Debe prometer una experiencia o beneficio. (Ej: "Desconecta en el corazón del bosque").
        2. "introParagraph": Un párrafo introductorio (2-3 frases) que enganche al visitante, mencione la propuesta de valor única y lo invite a explorar.

        Respuesta SOLO JSON válido:
        {
            "h1": "...",
            "introParagraph": "..."
        }
    `;
    try {
        const raw = await llamarGeminiAPI(prompt);
        return JSON.parse(raw);
    } catch (e) {
        return JSON.parse(await llamarIASimulada("generar el contenido principal"));
    }
};

// 3. Descripción Alojamiento (ENRIQUECIDA CON IDENTIDAD DE MARCA)
const generarDescripcionAlojamiento = async (desc, nombre, empresa, ubicacion, tipo, marketing, contextoExtra = {}) => {
    const { historia, slogan, palabrasClave, componentes } = contextoExtra;

    let detallesComponentes = '';
    if (componentes && Array.isArray(componentes) && componentes.length > 0) {
        detallesComponentes = "\n        DETALLES ESPECÍFICOS (Componentes y Amenidades):";
        componentes.forEach(comp => {
            detallesComponentes += `\n        - ${comp.nombre} (${comp.tipo}): `;
            if (comp.elementos && comp.elementos.length > 0) {
                const elementosStr = comp.elementos.map(e => {
                    return e.permiteCantidad && e.cantidad > 1 ? `${e.cantidad}x ${e.nombre}` : e.nombre;
                }).join(', ');
                detallesComponentes += elementosStr;
            } else {
                detallesComponentes += "Sin detalles específicos.";
            }
        });
    }

    const prompt = `
        Actúa como un Copywriter Senior especializado en Turismo y Hospitalidad.
        Tu objetivo es redactar una descripción irresistible para una unidad de alojamiento específica ("${nombre}"), asegurándote de que esté perfectamente alineada con la identidad general de la marca "${empresa}".

        INFORMACIÓN DE LA MARCA (Contexto Global):
        - Historia/Identidad: "${historia || 'No especificada'}"
        - Slogan: "${slogan || ''}"
        - Enfoque de Marketing: "${marketing}"
        - Palabras Clave de Marca: "${palabrasClave || ''}"
        - Ubicación General: "${ubicacion}"

        INFORMACIÓN DE LA UNIDAD (Alojamiento Específico):
        - Nombre: "${nombre}"
        - Tipo: "${tipo}"
        - Descripción Base (Borrador): "${desc || ''}"
        ${detallesComponentes}

        INSTRUCCIONES DE REDACCIÓN:
        1. Escribe un texto persuasivo de 2 a 3 párrafos.
        2. Integra sutilmente el slogan o la esencia de la historia de la marca para dar sentido de pertenencia.
        3. Destaca las características únicas de esta unidad ("${nombre}") basándote en los DETALLES ESPECÍFICOS proporcionados.
        4. Usa un tono que corresponda al enfoque "${marketing}" (ej. si es "Relax", usa palabras calmantes; si es "Aventura", usa verbos dinámicos).
        5. Incluye palabras clave SEO de forma natural.
        6. NO inventes características físicas que no estén en la descripción base o en los detalles específicos.

        Salida: Texto plano listo para publicar en la web.
    `;
    return await llamarGeminiAPI(prompt);
};

// 4. Generar Perfil Empresa (ESTRATEGIA TOTAL: SEO + CONTENIDO + IDENTIDAD)
const generarPerfilEmpresa = async (historia) => {
    const prompt = `
        Actúa como un Director de Marketing Digital y Experto SEO para Hotelería.
        
        INPUT: Historia/Descripción cruda del cliente:
        "${historia}"

        OBJETIVO:
        Transformar esta información en una ESTRATEGIA DIGITAL COMPLETA para el sitio web.
        Todos los textos deben estar alineados con la identidad de la marca, optimizados para Google Hotels y diseñados para la conversión directa.

        TAREA 1: ANÁLISIS Y REFINAMIENTO
        - Extrae los puntos fuertes (USPs).
        - Reescribe la historia ("historiaOptimizada") para que sea inspiradora, profesional y venda la experiencia.

        TAREA 2: ESTRATEGIA DE IDENTIDAD
        1. "slogan": Frase comercial potente y evocadora (máx 60 caracteres).
        2. "enfoqueMarketing": Elige UNO: Familiar, Parejas, Negocios, Aventura, Relax, Económico, Lujo.
        3. "palabrasClaveAdicionales": 5-8 tags SEO de cola larga (long-tail) específicos (ej: "cabañas con tinaja pucón", "escapada romántica sur de chile").
        4. "tipoAlojamientoPrincipal": Definición comercial exacta (ej: "Lodge de Montaña & Spa").

        TAREA 3: IMAGEN DE PORTADA (HERO) - BRANDING
        Genera textos para la imagen principal que refuercen la promesa de marca (NO describas una foto genérica, describe la EXPERIENCIA que vende la marca).
        5. "heroAlt": Texto alternativo SEO. Debe conectar la imagen con la ubicación y la oferta de valor (ej: "Pareja disfrutando tinaja caliente al atardecer en Lodge Pucón").
        6. "heroTitle": Título comercial de la imagen (ej: "Relax y Conexión en la Naturaleza").

        TAREA 4: SEO PÁGINA DE INICIO (HOME)
        7. "homeSeoTitle": Meta Título (<title>). Formato: [Promesa de Valor] | [Nombre/Ubicación] (máx 60 chars).
        8. "homeSeoDesc": Meta Descripción. Persuasiva, incluye ubicación y CTA implícito (máx 155 chars).

        TAREA 5: CONTENIDO PÁGINA DE INICIO (ABOVE THE FOLD)
        9. "homeH1": El Gran Titular de la web. Debe ser magnético y resumir la propuesta única (ej: "Tu Refugio Privado entre Bosques Milenarios").
        10. "homeIntro": Párrafo de introducción (2-3 líneas). Engancha al usuario emocionalmente e invítalo a reservar.

        Responde SOLO JSON válido:
        {
            "historiaOptimizada": "...",
            "slogan": "...",
            "enfoqueMarketing": "...",
            "palabrasClaveAdicionales": "...",
            "tipoAlojamientoPrincipal": "...",
            "heroAlt": "...",
            "heroTitle": "...",
            "homeSeoTitle": "...",
            "homeSeoDesc": "...",
            "homeH1": "...",
            "homeIntro": "..."
        }
    `;

    try {
        const raw = await llamarGeminiAPI(prompt);
        // Clean potential markdown code blocks
        const cleanRaw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleanRaw);

        // Validación básica
        if (!json.slogan || !json.historiaOptimizada) throw new Error("Respuesta incompleta de IA");

        return json;

    } catch (e) {
        console.error("Error en generarPerfilEmpresa:", e);
        // Fallback inteligente
        return {
            slogan: "Tu destino ideal",
            enfoqueMarketing: "Relax",
            palabrasClaveAdicionales: "alojamiento, turismo, descanso",
            tipoAlojamientoPrincipal: "Alojamiento Turístico",
            historiaOptimizada: historia,
            heroAlt: "Vista principal del alojamiento",
            heroTitle: "Bienvenidos",
            homeSeoTitle: "Inicio | Alojamiento Turístico",
            homeSeoDesc: "Reserva tu estadía con nosotros y disfruta de una experiencia inolvidable.",
            homeH1: "Bienvenidos a nuestro alojamiento",
            homeIntro: "Descubre un lugar único para descansar y conectar con la naturaleza.",
            error: "No se pudo optimizar completamente con IA. Se usaron valores base."
        };
    }
};

// 5. Metadata Imagen (STRICT VISUAL AUDITOR + SEO)
const generarMetadataImagen = async (empresa, propiedad, desc, componente, tipo, imageBuffer, contextoEsperado = null) => {

    // Si hay contexto específico del Wizard, lo añadimos al prompt
    let instruccionAuditoria = '';
    if (contextoEsperado) {
        instruccionAuditoria = `
            TAREA CRÍTICA DEL WIZARD: El usuario debe subir específicamente: "${contextoEsperado}".
            Verifica si la imagen cumple con este requisito específico.
            - Si se pide "Vista de la cama" y suben una vista general donde la cama apenas se ve: RECHÁZALO.
            - Si se pide "Detalle del baño" y suben una foto panorámica: RECHÁZALO.
            Si no cumple, el campo 'advertencia' debe decir: "No cumple con el requisito: ${contextoEsperado}".
        `;
    } else {
        // Auditoría general si no es subida guiada
        instruccionAuditoria = `
            AUDITORÍA GENERAL: ¿La foto coincide con el tipo de espacio "${tipo}"?
           - Si suben un baño y es "Dormitorio": DETECTARLO.
           - Si suben un paisaje y es "Cocina": DETECTARLO.
           - Si la foto es borrosa o mala: DETECTARLO.
        `;
    }

    const prompt = `
        Eres un Experto SEO para Google Hotels y un Auditor de Calidad Visual.
        
        CONTEXTO: Foto para el espacio: "${componente}" (Categoría: ${tipo}).
        PROPIEDAD: "${propiedad}" (Empresa: ${empresa}).
        DESCRIPCIÓN PROPIEDAD: "${desc}".
        
        ${instruccionAuditoria}

        TAREAS DE GENERACIÓN DE METADATOS (SEO):
        1. "altText": Genera un texto alternativo optimizado para SEO (máx 125 caracteres). 
           - DEBE incluir palabras clave visuales (ej: "con vista al volcán", "cama king", "tinaja de madera").
           - NO uses frases genéricas como "foto de la habitación". Sé descriptivo.
        2. "title": Un título comercial atractivo (máx 60 caracteres).
           - Ej: "Dormitorio Principal con Vista", "Terraza Panorámica".

        Responde SOLO JSON:
        {
            "altText": "...",
            "title": "...",
            "advertencia": "Mensaje corto de error si no cumple la auditoría. Si está bien, pon null."
        }
    `;

    try {
        const raw = await llamarGeminiAPI(prompt, imageBuffer);
        const json = JSON.parse(raw);
        if (!json.altText || !json.title) throw new Error("JSON incompleto");
        return json;
    } catch (e) {
        console.warn("Fallo generación metadata imagen:", e);
        // Si falla la IA, si había un contexto esperado, asumimos que no se cumplió por seguridad
        return {
            altText: `${componente} en ${propiedad}`,
            title: componente,
            advertencia: contextoEsperado ? `Error de IA verificando: ${contextoEsperado}. Intente de nuevo.` : null
        };
    }
};

// 6. Generar Estructura de Alojamiento (JSON-LD Friendly)
const generarEstructuraAlojamiento = async (descripcion, tiposDisponibles) => {
    const tiposInfo = tiposDisponibles.map(t => `- ${t.nombreNormalizado} (ID: ${t.id})`).join('\n');

    const prompt = `
        Actúa como un Arquitecto de Datos para un PMS (Property Management System).
        Tu objetivo es analizar una descripción en lenguaje natural de una propiedad y convertirla en una estructura de datos jerárquica estricta.

        INPUT (Descripción del Usuario):
        "${descripcion}"

        INPUT (Tipos de Espacios Disponibles):
        ${tiposInfo}

        REGLAS DE NEGOCIO:
        1. Identifica cada espacio mencionado (Dormitorios, Baños, Cocina, Terraza, etc.).
        2. Asigna el "tipoId" correcto basándose en la lista de Tipos Disponibles. Si no hay coincidencia exacta, usa el más cercano o "Otro".
        3. DETECCIÓN DE CAMAS Y CAPACIDAD (CRÍTICO):
           - Identifica CUALQUIER mueble apto para dormir: Camas, Literas, Camarotes, Sofá Cama, Futón, Catre, Cama Nido, Colchón Inflable, etc.
           - Para cada elemento, intenta determinar su capacidad (Simple/1 persona o Doble/2 personas) basándote en el contexto o adjetivos (ej: "Matrimonial", "King", "Doble", "2 Plazas" implican 2 personas).
           - Nombra el elemento de forma explícita incluyendo su capacidad si es posible (ej: "Sofá Cama Doble", "Catre de Campaña", "Colchón Inflable 2 Plazas").
           - Si dice "2 camas matrimoniales", crea 2 elementos (o 1 elemento con cantidad 2).
        4. Para "Baños", identifica si es "En Suite" (dentro de un dormitorio) o "Compartido".
           - Si es "En Suite", intenta ponerlo DENTRO del componente dormitorio si la estructura lo permite, o nómbralo claramente "Baño en Suite Dormitorio X".
        5. Genera un nombre descriptivo para cada componente (ej: "Dormitorio Principal", "Baño Pasillo", "Cocina Americana").

        FORMATO DE SALIDA (JSON ARRAY):
        [
            {
                "nombre": "Dormitorio Principal",
                "tipoId": "ID_DEL_TIPO_DORMITORIO",
                "elementos": [
                    { "nombre": "Cama King", "cantidad": 1, "categoria": "CAMA" },
                    { "nombre": "Sofá Cama Doble", "cantidad": 1, "categoria": "OTROS" }
                ]
            },
            ...
        ]

        Responde SOLO JSON válido.
    `;

    try {
        const raw = await llamarGeminiAPI(prompt);
        const cleanRaw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanRaw);
    } catch (e) {
        console.error("Error generando estructura:", e);
        return []; // Retornar array vacío en caso de error
    }
};

module.exports = {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarEstructuraAlojamiento
};