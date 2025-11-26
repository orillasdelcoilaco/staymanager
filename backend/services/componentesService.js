// backend/services/componentesService.js
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.RENDER) {
    require('dotenv').config();
}
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// *** CORRECCIÓN CRÍTICA: Usar el modelo gemini-2.5-flash ***
const model = genAI ? genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" }) : null;

const obtenerTiposPorEmpresa = async (db, empresaId) => {
    console.log(`[Service] Consultando tipos para empresa: ${empresaId}`);
    const snapshot = await db.collection('empresas').doc(empresaId)
                             .collection('tiposComponente')
                             .get(); // Sin orderBy por si faltan índices
    
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const analizarNuevoTipoConIA = async (nombreUsuario) => {
    if (!model) return {
        nombreNormalizado: nombreUsuario,
        icono: "📍",
        descripcionBase: "Espacio definido manualmente.",
        shotList: ["Vista general"],
        palabrasClave: [nombreUsuario]
    };

    const prompt = `
        Actúa como Arquitecto. Analiza el espacio: "${nombreUsuario}".
        Responde SOLO JSON válido:
        {
            "nombreNormalizado": "Nombre estándar comercial",
            "icono": "Emoji representativo",
            "descripcionBase": "Definición breve",
            "shotList": [
                "Instrucción foto 1",
                "Instrucción foto 2 (detalle)",
                "Instrucción foto 3 (ángulo)"
            ],
            "palabrasClave": ["keyword1", "keyword2"]
        }
    `;

    try {
        console.log(`[Componentes IA] Analizando con modelo 2.5: ${nombreUsuario}...`);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error("[IA Error]", error);
        return {
            nombreNormalizado: nombreUsuario,
            icono: "🏠",
            descripcionBase: "Espacio del alojamiento.",
            shotList: ["Vista General", "Detalle"],
            palabrasClave: [nombreUsuario]
        };
    }
};

const crearTipoComponente = async (db, empresaId, datos) => {
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