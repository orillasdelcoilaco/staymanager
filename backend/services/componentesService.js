// backend/services/componentesService.js
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configuración IA (Reutilizamos la key existente)
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

/**
 * CRUD: Obtener todos los tipos de componentes de una empresa
 */
const obtenerTiposPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId)
                             .collection('tiposComponente')
                             .orderBy('nombre', 'asc')
                             .get();
    
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * IA: Analiza un nombre de espacio y genera su perfil técnico y visual.
 */
const analizarNuevoTipoConIA = async (nombreUsuario) => {
    if (!model) throw new Error("Servicio de IA no disponible.");

    const prompt = `
        Actúa como un Arquitecto y Experto en Marketing Inmobiliario.
        Analiza el siguiente espacio/componente de una propiedad turística: "${nombreUsuario}".

        Tu tarea es estandarizarlo y definir qué fotografías son necesarias para venderlo bien en Internet.

        Responde SOLO con un objeto JSON (sin markdown) con esta estructura exacta:
        {
            "nombreNormalizado": "Nombre estándar (ej: Zona de Barbacoa)",
            "icono": "Un solo emoji representativo (ej: 🔥)",
            "descripcionBase": "Breve definición comercial (máx 1 frase)",
            "shotList": [
                "Lista de 3 a 5 fotos OBLIGATORIAS para mostrar este espacio correctamente.",
                "Deben ser instrucciones claras de fotografía (ej: 'Vista frontal con la parrilla abierta', 'Detalle de la mesa')."
            ],
            "palabrasClave": ["3-5", "keywords", "para", "seo"]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        // Limpieza de formato
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("[IA Error] Fallo al analizar componente:", error);
        // Fallback manual si la IA falla
        return {
            nombreNormalizado: nombreUsuario,
            icono: "🏠",
            descripcionBase: "Espacio del alojamiento.",
            shotList: ["Vista General", "Detalle de equipamiento"],
            palabrasClave: [nombreUsuario]
        };
    }
};

/**
 * CRUD: Crear un nuevo tipo (Guardar el resultado de la IA)
 */
const crearTipoComponente = async (db, empresaId, datos) => {
    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc();
    const nuevoTipo = {
        id: ref.id,
        ...datos,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(nuevoTipo);
    return nuevoTipo;
};

/**
 * CRUD: Eliminar un tipo
 */
const eliminarTipoComponente = async (db, empresaId, tipoId) => {
    await db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId).delete();
};

module.exports = {
    obtenerTiposPorEmpresa,
    analizarNuevoTipoConIA,
    crearTipoComponente,
    eliminarTipoComponente
};