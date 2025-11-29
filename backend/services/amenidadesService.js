// backend/services/amenidadesService.js
const admin = require('firebase-admin');

const obtenerTipos = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId)
        .collection('tiposAmenidad')
        .orderBy('categoria')
        .get();

    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const crearTipo = async (db, empresaId, datos) => {
    // datos: { nombre, icono, categoria: 'CAMA'|'BANO'|'EQUIPAMIENTO', descripcion }
    if (!datos.nombre || !datos.categoria) {
        throw new Error('Nombre y categoría son obligatorios');
    }

    const ref = db.collection('empresas').doc(empresaId).collection('tiposAmenidad').doc();
    const nuevoTipo = {
        id: ref.id,
        nombre: datos.nombre,
        icono: datos.icono || '✨',
        categoria: datos.categoria,
        descripcion: datos.descripcion || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(nuevoTipo);
    return nuevoTipo;
};

const eliminarTipo = async (db, empresaId, tipoId) => {
    await db.collection('empresas').doc(empresaId).collection('tiposAmenidad').doc(tipoId).delete();
};

module.exports = {
    obtenerTipos,
    crearTipo,
    eliminarTipo
};
