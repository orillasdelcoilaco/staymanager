// backend/services/contentFactoryService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { hydrateInventory } = require('./propiedadLogicService');

// Load dotenv only if not in production
if (!process.env.RENDER) {
    require('dotenv').config();
}

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null;

// --- Helper: Fallback AI ---
async function llamarIASimulada(prompt) {
    console.log("--- [ContentFactory] Usando respuesta simulada (Fallback) ---");
    return JSON.stringify({
        error: "IA no disponible (Simulado)",
        description: "Descripción generada automáticamente por fallback.",
        h1: "Título Generado",
        seo: { title: "Título SEO", description: "Desc SEO" }
    });
}

// --- Helper: Call Gemini API ---
async function llamarGeminiAPI(prompt, imageBuffer = null) {
    if (!model) return llamarIASimulada(prompt);

    try {
        let result;
        if (imageBuffer) {
            console.log(`[ContentFactory] 👁️ Procesando IMAGEN + TEXTO...`);
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/webp"
                },
            };
            result = await model.generateContent([prompt, imagePart]);
        } else {
            console.log(`[ContentFactory] 📝 Procesando SOLO TEXTO...`);
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        let text = response.text();
        return text.replace(/```json/g, '').replace(/```/g, '').trim();

    } catch (error) {
        console.error("[ContentFactory] Error Gemini API:", error.message);
        throw error;
    }
}

/**
 * 1. Optimizar Perfil de Alojamiento
 * Genera descripción comercial, H1 y SEO basado en datos básicos y componentes.
 */
const optimizarPerfilAlojamiento = async (db, empresaId, alojamientoId) => {
    // 1. Obtener datos del alojamiento y sus subcolecciones
    const alojamientoRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(alojamientoId);
    const alojamientoDoc = await alojamientoRef.get();

    if (!alojamientoDoc.exists) throw new Error("Alojamiento no encontrado");
    const alojamiento = alojamientoDoc.data();

    // Leer subcolecciones (Componentes y Amenidades)
    const componentesSnap = await alojamientoRef.collection('componentes').get();
    const amenidadesSnap = await alojamientoRef.collection('amenidades').get();

    const componentes = componentesSnap.docs.map(d => d.data());
    const amenidades = amenidadesSnap.docs.map(d => d.data());

    // 2. Construir Contexto
    const contexto = {
        nombre: alojamiento.nombre,
        tipo: alojamiento.tipo || "Alojamiento Turístico",
        descripcionBase: alojamiento.descripcion || "",
        componentes: componentes.map(c => `${c.cantidad || 1}x ${c.nombre} (${c.tipo})`).join(', '),
        amenidades: amenidades.map(a => a.label).join(', ')
    };

    // 3. Prompt
    const prompt = `
        Actúa como un Copywriter Senior y Experto SEO para Turismo.
        Genera el perfil comercial completo para este alojamiento.

        DATOS:
        - Nombre: "${contexto.nombre}"
        - Tipo: "${contexto.tipo}"
        - Descripción Base: "${contexto.descripcionBase}"
        - Componentes: ${contexto.componentes}
        - Amenidades: ${contexto.amenidades}

        TAREA:
        1. "marketingDescription": Descripción persuasiva (2-3 párrafos) enfocada en la experiencia.
        2. "h1": Un título H1 atractivo para la landing page del alojamiento.
        3. "seo": Objeto con "title" (meta title, max 60 chars) y "description" (meta description, max 155 chars).
        4. "shortDescription": Una frase corta (max 150 chars) para tarjetas/listados.

        Responde SOLO JSON válido.
    `;

    // 4. Llamar IA
    const rawResponse = await llamarGeminiAPI(prompt);
    const jsonResponse = JSON.parse(rawResponse);

    // 5. Guardar resultado en Firestore (campo websiteData)
    await alojamientoRef.update({
        websiteData: {
            ...alojamiento.websiteData,
            aiDescription: jsonResponse.marketingDescription,
            h1: jsonResponse.h1,
            seo: jsonResponse.seo,
            shortDescription: jsonResponse.shortDescription,
            lastOptimized: new Date()
        }
    });

    return jsonResponse;
};

/**
 * 2. Analizar Requisitos de Fotos
 * Recorre los componentes y define cuántas fotos se necesitan y de qué tipo.
 */
const analizarRequisitosFotos = async (db, empresaId, alojamientoId) => {
    const alojamientoRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(alojamientoId);
    const componentesRef = alojamientoRef.collection('componentes');
    const snapshot = await componentesRef.get();

    const updates = [];

    for (const doc of snapshot.docs) {
        const comp = doc.data();

        // Lógica simple de reglas (podría ser IA también, pero reglas es más rápido y predecible para esto)
        let cantidadFotos = 1;
        let sugerencia = "Vista general";

        switch (comp.tipo?.toLowerCase()) {
            case 'dormitorio':
                cantidadFotos = 3;
                sugerencia = "1. Vista general, 2. Detalle cama, 3. Ángulo inverso/closet";
                break;
            case 'baño':
                cantidadFotos = 2;
                sugerencia = "1. Lavamanos/Espejo, 2. Ducha/Tina";
                break;
            case 'cocina':
                cantidadFotos = 2;
                sugerencia = "1. Vista general, 2. Equipamiento/Detalle";
                break;
            case 'terraza':
            case 'quincho':
                cantidadFotos = 2;
                sugerencia = "1. Vista al entorno, 2. Equipamiento";
                break;
            default:
                cantidadFotos = 1;
        }

        updates.push(doc.ref.update({
            cantidadRequeridaFotos: cantidadFotos,
            sugerenciaFotos: sugerencia
        }));
    }

    await Promise.all(updates);
    return { message: "Requisitos de fotos actualizados", totalComponentes: updates.length };
};

/**
 * 3. Auditar Foto
 * Valida si una foto corresponde al componente indicado y genera metadatos.
 */
const auditarFoto = async (imageBuffer, contexto) => {
    const { tipoComponente, nombreComponente, nombreAlojamiento } = contexto;

    const prompt = `
        Eres un Auditor de Calidad Visual y Experto SEO para Hotelería.
        
        CONTEXTO:
        - Alojamiento: "${nombreAlojamiento}"
        - Componente esperado: "${nombreComponente}" (Tipo: ${tipoComponente})
        
        TAREA:
        1. Analiza la imagen. ¿Corresponde AL TIPO de componente esperado?
           - Ejemplo: Si tipo="Dormitorio" y la foto es un baño -> RECHAZAR.
           - Ejemplo: Si tipo="Cocina" y la foto es una cama -> RECHAZAR.
        2. Si la foto NO corresponde o es de muy baja calidad (borrosa/oscura), marca "aprobado": false y explica por qué en "motivoRechazo".
        3. Si corresponde, marca "aprobado": true.
        4. Genera metadatos SEO PRO:
           - "altText": Descriptivo, incluye keywords visuales (ej. "Cama king con vista al bosque").
           - "title": Comercial (ej. "Dormitorio Principal Suite 1").
           - "tags": Array de 5-8 tags relevantes (ej. ["cama king", "vista bosque", "lujo", "interior"]).

        Responde SOLO JSON válido:
        {
            "aprobado": boolean,
            "motivoRechazo": string | null,
            "altText": string,
            "title": string,
            "tags": string[]
        }
    `;

    const rawResponse = await llamarGeminiAPI(prompt, imageBuffer);
    return JSON.parse(rawResponse);
};

module.exports = {
    optimizarPerfilAlojamiento,
    analizarRequisitosFotos,
    auditarFoto
};
