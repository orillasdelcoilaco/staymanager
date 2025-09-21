const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de canales de venta.
 */

const crearCanal = async (db, empresaId, datosCanal) => {
    if (!empresaId || !datosCanal.nombre) {
        throw new Error('El ID de la empresa y el nombre del canal son requeridos.');
    }

    const canalRef = db.collection('empresas').doc(empresaId).collection('canales').doc();
    
    const nuevoCanal = {
        nombre: datosCanal.nombre,
        clienteIdCanal: datosCanal.clienteIdCanal || '',
        descripcion: datosCanal.descripcion || '',
        moneda: datosCanal.moneda || 'CLP', // <-- AÑADIDO
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await canalRef.set(nuevoCanal);

    return { id: canalRef.id, ...nuevoCanal };
};

const obtenerCanalesPorEmpresa = async (db, empresaId) => {
    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').orderBy('nombre').get();
    
    if (canalesSnapshot.empty) {
        return [];
    }

    return canalesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const actualizarCanal = async (db, empresaId, canalId, datosActualizados) => {
    const canalRef = db.collection('empresas').doc(empresaId).collection('canales').doc(canalId);
    
    await canalRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: canalId, ...datosActualizados };
};

const eliminarCanal = async (db, empresaId, canalId) => {
    const canalRef = db.collection('empresas').doc(empresaId).collection('canales').doc(canalId);
    await canalRef.delete();
};

module.exports = {
    crearCanal,
    obtenerCanalesPorEmpresa,
    actualizarCanal,
    eliminarCanal
};