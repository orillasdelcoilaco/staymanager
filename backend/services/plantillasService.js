const admin = require('firebase-admin');

// --- Lógica para Tipos de Plantilla ---

const crearTipoPlantilla = async (db, empresaId, datosTipo) => {
    if (!empresaId || !datosTipo.nombre) {
        throw new Error('El nombre del tipo de plantilla es requerido.');
    }
    const tipoRef = db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc();
    const nuevoTipo = {
        id: tipoRef.id,
        nombre: datosTipo.nombre,
        descripcion: datosTipo.descripcion || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await tipoRef.set(nuevoTipo);
    return nuevoTipo;
};

const obtenerTiposPlantilla = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarTipoPlantilla = async (db, empresaId, tipoId, datosActualizados) => {
    const tipoRef = db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId);
    await tipoRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: tipoId, ...datosActualizados };
};

const eliminarTipoPlantilla = async (db, empresaId, tipoId) => {
    // Opcional: Validar que no haya plantillas usando este tipo antes de eliminar.
    const plantillasSnapshot = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').where('tipoId', '==', tipoId).limit(1).get();
    if (!plantillasSnapshot.empty) {
        throw new Error('No se puede eliminar el tipo porque está siendo usado por al menos una plantilla.');
    }
    await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId).delete();
};

// --- Lógica para Plantillas de Mensajes ---

const crearPlantilla = async (db, empresaId, datosPlantilla) => {
    if (!empresaId || !datosPlantilla.nombre || !datosPlantilla.tipoId || !datosPlantilla.texto) {
        throw new Error('Nombre, tipo y texto de la plantilla son requeridos.');
    }
    const plantillaRef = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc();
    const nuevaPlantilla = {
        id: plantillaRef.id,
        ...datosPlantilla,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await plantillaRef.set(nuevaPlantilla);
    return nuevaPlantilla;
};

const obtenerPlantillasPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarPlantilla = async (db, empresaId, plantillaId, datosActualizados) => {
    const plantillaRef = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId);
    await plantillaRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: plantillaId, ...datosActualizados };
};

const eliminarPlantilla = async (db, empresaId, plantillaId) => {
    await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId).delete();
};


module.exports = {
    crearTipoPlantilla,
    obtenerTiposPlantilla,
    actualizarTipoPlantilla,
    eliminarTipoPlantilla,
    crearPlantilla,
    obtenerPlantillasPorEmpresa,
    actualizarPlantilla,
    eliminarPlantilla
};