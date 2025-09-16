const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de propiedades (alojamientos).
 */

/**
 * Crea una nueva propiedad para una empresa específica.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa a la que pertenece la propiedad.
 * @param {object} datosPropiedad - Los datos de la propiedad a crear (ej. { nombre, capacidad }).
 * @returns {Promise<object>} - La propiedad recién creada con su ID.
 */
const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre || !datosPropiedad.capacidad) {
        throw new Error('El ID de la empresa, el nombre y la capacidad de la propiedad son requeridos.');
    }

    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc();
    
    const nuevaPropiedad = {
        ...datosPropiedad,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await propiedadRef.set(nuevaPropiedad);

    return { id: propiedadRef.id, ...nuevaPropiedad };
};

/**
 * Obtiene todas las propiedades de una empresa.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa.
 * @returns {Promise<Array<object>>} - Un array con todas las propiedades de la empresa.
 */
const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();
    
    if (propiedadesSnapshot.empty) {
        return [];
    }

    const propiedades = propiedadesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    return propiedades;
};

/**
 * Actualiza una propiedad existente.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa.
 * @param {string} propiedadId - El ID de la propiedad a actualizar.
 * @param {object} datosActualizados - Los campos a actualizar.
 * @returns {Promise<object>} - El objeto de la propiedad actualizada.
 */
const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    
    await propiedadRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: propiedadId, ...datosActualizados };
};

/**
 * Elimina una propiedad.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa.
 * @param {string} propiedadId - El ID de la propiedad a eliminar.
 * @returns {Promise<void>}
 */
const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    await propiedadRef.delete();
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    actualizarPropiedad,
    eliminarPropiedad
};