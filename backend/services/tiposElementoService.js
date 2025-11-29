const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

const COLLECTION_NAME = 'tiposElemento';

/**
 * Obtiene todos los tipos de elemento de una empresa.
 * @param {Object} db
 * @param {string} empresaId 
 * @returns {Promise<Array>}
 */
async function obtenerTipos(db, empresaId) {
    try {
        const snapshot = await db.collection('empresas')
            .doc(empresaId)
            .collection(COLLECTION_NAME)
            .get();

        if (snapshot.empty) return [];

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener tipos de elemento:", error);
        throw new Error("Error al obtener tipos de elemento.");
    }
}

/**
 * Crea un nuevo tipo de elemento.
 * @param {Object} db
 * @param {string} empresaId 
 * @param {Object} datos - { nombre, categoria, icono, permiteCantidad }
 * @returns {Promise<Object>}
 */
async function crearTipo(db, empresaId, datos) {
    try {
        const id = uuidv4();
        const nuevoTipo = {
            nombre: datos.nombre,
            categoria: datos.categoria, // 'CAMA', 'BANO_ELEMENTO', 'EQUIPAMIENTO'
            icono: datos.icono || '🔹',
            permiteCantidad: datos.permiteCantidad !== false, // Default true
            countable: datos.countable || false,
            count_value_default: datos.count_value_default || 0,
            photo_requirements_default: Array.isArray(datos.photo_requirements_default) ? datos.photo_requirements_default : [],

            // SEO Semántico (Schema.org)
            schema_type: datos.schema_type || 'Thing', // ej: 'BedDetails', 'LocationFeatureSpecification'
            schema_property: datos.schema_property || 'amenityFeature', // ej: 'bed', 'amenityFeature'

            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('empresas')
            .doc(empresaId)
            .collection(COLLECTION_NAME)
            .doc(id)
            .set(nuevoTipo);

        return { id, ...nuevoTipo };
    } catch (error) {
        console.error("Error al crear tipo de elemento:", error);
        throw new Error("Error al crear tipo de elemento.");
    }
}

/**
 * Elimina un tipo de elemento.
 * @param {Object} db
 * @param {string} empresaId 
 * @param {string} tipoId 
 */
async function eliminarTipo(db, empresaId, tipoId) {
    try {
        await db.collection('empresas')
            .doc(empresaId)
            .collection(COLLECTION_NAME)
            .doc(tipoId)
            .delete();
    } catch (error) {
        console.error("Error al eliminar tipo de elemento:", error);
        throw new Error("Error al eliminar tipo de elemento.");
    }
}

module.exports = {
    obtenerTipos,
    crearTipo,
    eliminarTipo
};
