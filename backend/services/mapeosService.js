const admin = require('firebase-admin');

/**
 * Contiene la lógica de negocio para la gestión de mapeos de columnas por canal.
 */

const guardarMapeo = async (db, empresaId, datosMapeo) => {
    if (!empresaId || !datosMapeo.canalId || !datosMapeo.campoInterno || !datosMapeo.nombresExternos) {
        throw new Error('Faltan datos requeridos para guardar el mapeo.');
    }

    // Usaremos el ID del canal y el nombre del campo interno como ID del documento para asegurar que sea único
    const mapeoId = `${datosMapeo.canalId}_${datosMapeo.campoInterno}`;
    const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);
    
    const nuevoMapeo = {
        id: mapeoId,
        canalId: datosMapeo.canalId,
        canalNombre: datosMapeo.canalNombre,
        campoInterno: datosMapeo.campoInterno,
        // Guardamos los nombres externos como un array de strings
        nombresExternos: datosMapeo.nombresExternos.split(',').map(s => s.trim()).filter(Boolean),
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await mapeoRef.set(nuevoMapeo, { merge: true });
    return nuevoMapeo;
};

const obtenerMapeosPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('mapeosCanal').orderBy('canalNombre').orderBy('campoInterno').get();
    
    if (snapshot.empty) {
        return [];
    }

    return snapshot.docs.map(doc => doc.data());
};


const eliminarMapeo = async (db, empresaId, mapeoId) => {
    const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);
    await mapeoRef.delete();
};

module.exports = {
    guardarMapeo,
    obtenerMapeosPorEmpresa,
    eliminarMapeo
};