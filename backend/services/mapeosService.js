const admin = require('firebase-admin');

/**
 * Guarda el conjunto completo de mapeos para un canal específico.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa.
 * @param {string} canalId - El ID del canal para el que se guardan los mapeos.
 * @param {Array<object>} mapeos - Un array de objetos, cada uno con { campoInterno, nombresExternos }.
 * @returns {Promise<void>}
 */
const guardarMapeosPorCanal = async (db, empresaId, canalId, mapeos) => {
    if (!empresaId || !canalId || !mapeos) {
        throw new Error('Faltan datos requeridos para guardar los mapeos.');
    }

    const batch = db.batch();

    mapeos.forEach(mapeo => {
        const { campoInterno, nombresExternos } = mapeo;
        // Usamos el ID del canal y el campo interno para crear un ID de documento único y predecible
        const mapeoId = `${canalId}_${campoInterno}`;
        const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);

        const datosMapeo = {
            id: mapeoId,
            canalId: canalId,
            campoInterno: campoInterno,
            // Convertimos el string separado por comas en un array limpio
            nombresExternos: nombresExternos.split(',').map(s => s.trim()).filter(Boolean),
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };

        // Si no hay nombres externos, eliminamos la regla. Si los hay, la creamos o actualizamos.
        if (datosMapeo.nombresExternos.length > 0) {
            batch.set(mapeoRef, datosMapeo, { merge: true });
        } else {
            batch.delete(mapeoRef);
        }
    });

    await batch.commit();
};

/**
 * Obtiene todos los mapeos de una empresa, organizados por canal.
 * @param {object} db - La instancia de Firestore.
 * @param {string} empresaId - El ID de la empresa.
 * @returns {Promise<Array<object>>}
 */
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