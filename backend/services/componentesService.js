// backend/services/componentesService.js
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.RENDER) {
    require('dotenv').config();
}
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

const obtenerTiposPorEmpresa = async (db, empresaId) => {
    console.log(`[Service] Consultando tipos para empresa: ${empresaId}`);
    
    // CAMBIO: Quitamos orderBy temporalmente para asegurar que lee TODO lo que hay
    const snapshot = await db.collection('empresas').doc(empresaId)
                             .collection('tiposComponente')
                             .get();
    
    if (snapshot.empty) {
        console.log(`[Service] Consulta vacía. No hay tipos.`);
        return [];
    }
    
    const resultados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[Service] Encontrados ${resultados.length} tipos.`);
    return resultados;
};

const analizarNuevoTipoConIA = async (nombreUsuario) => {
    if (!model) return {
        nombreNormalizado: nombreUsuario,
        icono: "📍",
        descripcionBase: "Espacio del alojamiento.",
        shotList: ["Vista General", "Detalle"],
        palabrasClave: [nombreUsuario]
    };

    const prompt = `
        Actúa como Arquitecto. Analiza: "${nombreUsuario}".
        Responde JSON:
        {
            "nombreNormalizado": "Nombre estándar",
            "icono": "Emoji",
            "descripcionBase": "Definición breve",
            "shotList": ["Foto 1", "Foto 2", "Foto 3"],
            "palabrasClave": ["seo1", "seo2"]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("[IA Error]", error);
        return {
            nombreNormalizado: nombreUsuario,
            icono: "📍",
            descripcionBase: "Espacio definido manualmente.",
            shotList: ["Vista general"],
            palabrasClave: [nombreUsuario]
        };
    }
};

const crearTipoComponente = async (db, empresaId, datos) => {
    console.log(`[Service] Creando tipo "${datos.nombreNormalizado}" para empresa ${empresaId}`);
    
    // Validación de seguridad
    if (!empresaId) throw new Error("Intento de creación sin ID de empresa.");

    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc();
    
    const nuevoTipo = {
        id: ref.id,
        nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
        nombreNormalizado: datos.nombreNormalizado,
        icono: datos.icono || '📦',
        descripcionBase: datos.descripcionBase || '',
        shotList: datos.shotList || [],
        palabrasClave: datos.palabrasClave || [],
        origen: datos.origen || 'personalizado',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await ref.set(nuevoTipo);
    console.log(`[Service] Tipo creado con ID: ${ref.id}`);
    return nuevoTipo;
};

const eliminarTipoComponente = async (db, empresaId, tipoId) => {
    await db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId).delete();
};

module.exports = {
    obtenerTiposPorEmpresa,
    analizarNuevoTipoConIA,
    crearTipoComponente,
    eliminarTipoComponente
};