const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de tarifas.
 */

const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!empresaId || !datosTarifa.alojamientoId || !datosTarifa.temporada || !datosTarifa.fechaInicio || !datosTarifa.fechaTermino) {
        throw new Error('Faltan datos requeridos para crear la tarifa.');
    }

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    
    const nuevaTarifa = {
        ...datosTarifa,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await tarifaRef.set(nuevaTarifa);
    return { id: tarifaRef.id, ...nuevaTarifa };
};

const obtenerTarifasPorEmpresa = async (db, empresaId) => {
    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').orderBy('fechaInicio', 'desc').get();
    
    if (tarifasSnapshot.empty) {
        return [];
    }

    return tarifasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const actualizarTarifa = async (db, empresaId, tarifaId, datosActualizados) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    await tarifaRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: tarifaId, ...datosActualizados };
};

const eliminarTarifa = async (db, empresaId, tarifaId) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    await tarifaRef.delete();
};

module.exports = {
    crearTarifa,
    obtenerTarifasPorEmpresa,
    actualizarTarifa,
    eliminarTarifa
};