const admin = require('firebase-admin');

const guardarMapeosPorCanal = async (db, empresaId, canalId, mapeos) => {
    if (!empresaId || !canalId || !mapeos) {
        throw new Error('Faltan datos requeridos para guardar los mapeos.');
    }

    const batch = db.batch();
    const mapeosExistentesQuery = await db.collection('empresas').doc(empresaId).collection('mapeosCanal')
                                        .where('canalId', '==', canalId).get();

    // Primero, marcamos todos los mapeos existentes de este canal para ser eliminados.
    const aEliminar = new Set();
    mapeosExistentesQuery.forEach(doc => aEliminar.add(doc.ref));

    mapeos.forEach(mapeo => {
        const { campoInterno, nombreExterno } = mapeo;
        const mapeoId = `${canalId}_${campoInterno}`;
        const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);
        
        const datosMapeo = {
            id: mapeoId,
            canalId: canalId,
            campoInterno: campoInterno,
            // Guardamos el nombre externo como un array con un solo elemento para mantener compatibilidad
            nombresExternos: [nombreExterno],
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(mapeoRef, datosMapeo, { merge: true });
        
        // Si este mapeo estaba en la lista de "a eliminar", lo quitamos para no borrarlo.
        aEliminar.forEach(ref => {
            if (ref.id === mapeoRef.id) {
                aEliminar.delete(ref);
            }
        });
    });

    // Eliminamos los mapeos que ya no se usan (el usuario seleccionó "No aplicar").
    aEliminar.forEach(ref => batch.delete(ref));

    await batch.commit();
};

const obtenerMapeosPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('mapeosCanal').get();
    
    if (snapshot.empty) {
        return [];
    }

    return snapshot.docs.map(doc => doc.data());
};

module.exports = {
    guardarMapeosPorCanal,
    obtenerMapeosPorEmpresa
};