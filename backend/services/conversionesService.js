const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de conversiones de alojamientos.
 */

const crearConversion = async (db, empresaId, datos) => {
    if (!empresaId || !datos.alojamientoId || !datos.canalId || !datos.nombreExterno) {
        throw new Error('Faltan datos requeridos para crear la conversión.');
    }

    const conversionRef = db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc();
    
    const nuevaConversion = {
        ...datos,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await conversionRef.set(nuevaConversion);
    return { id: conversionRef.id, ...nuevaConversion };
};

const obtenerConversionesPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').orderBy('alojamientoNombre').get();
    
    if (snapshot.empty) {
        return [];
    }

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const actualizarConversion = async (db, empresaId, conversionId, datosActualizados) => {
    const conversionRef = db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc(conversionId);
    
    await conversionRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: conversionId, ...datosActualizados };
};

const eliminarConversion = async (db, empresaId, conversionId) => {
    const conversionRef = db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc(conversionId);
    await conversionRef.delete();
};

module.exports = {
    crearConversion,
    obtenerConversionesPorEmpresa,
    actualizarConversion,
    eliminarConversion
};