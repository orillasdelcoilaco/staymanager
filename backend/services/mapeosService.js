const admin = require('firebase-admin');

const guardarMapeosPorCanal = async (db, empresaId, canalId, mapeos, formatoFecha, separadorDecimal) => {
    if (!empresaId || !canalId || !mapeos) {
        throw new Error('Faltan datos requeridos para guardar los mapeos.');
    }

    const batch = db.batch();
    
    const canalRef = db.collection('empresas').doc(empresaId).collection('canales').doc(canalId);
    batch.update(canalRef, { 
        formatoFecha: formatoFecha,
        separadorDecimal: separadorDecimal // <-- GUARDAR SEPARADOR
    });

    const mapeosExistentesQuery = await db.collection('empresas').doc(empresaId).collection('mapeosCanal')
                                        .where('canalId', '==', canalId).get();

    const aEliminar = new Set();
    mapeosExistentesQuery.forEach(doc => aEliminar.add(doc.ref));

    mapeos.forEach(mapeo => {
        const { campoInterno, columnaIndex } = mapeo;
        if (campoInterno === undefined || columnaIndex === undefined) return;

        const mapeoId = `${canalId}_${campoInterno}`;
        const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);
        
        const datosMapeo = {
            id: mapeoId,
            canalId: canalId,
            campoInterno: campoInterno,
            columnaIndex: columnaIndex,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(mapeoRef, datosMapeo, { merge: true });
        
        aEliminar.forEach(ref => {
            if (ref.id === mapeoRef.id) {
                aEliminar.delete(ref);
            }
        });
    });

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