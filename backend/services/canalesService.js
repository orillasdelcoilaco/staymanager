const admin = require('firebase-admin');

const crearCanal = async (db, empresaId, datosCanal) => {
    if (!empresaId || !datosCanal.nombre) {
        throw new Error('El ID de la empresa y el nombre del canal son requeridos.');
    }

    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');

    return db.runTransaction(async (transaction) => {
        if (datosCanal.esCanalPorDefecto) {
            const q = canalesRef.where('esCanalPorDefecto', '==', true);
            const snapshotDefecto = await transaction.get(q);
            snapshotDefecto.forEach(doc => {
                transaction.update(doc.ref, { esCanalPorDefecto: false });
            });
        }

        const canalRef = canalesRef.doc();
        const nuevoCanal = {
            nombre: datosCanal.nombre,
            clienteIdCanal: datosCanal.clienteIdCanal || '',
            descripcion: datosCanal.descripcion || '',
            moneda: datosCanal.moneda || 'CLP',
            separadorDecimal: datosCanal.separadorDecimal || ',',
            esCanalPorDefecto: datosCanal.esCanalPorDefecto || false,
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.set(canalRef, nuevoCanal);
        return { id: canalRef.id, ...nuevoCanal };
    });
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
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalRef = canalesRef.doc(canalId);

    return db.runTransaction(async (transaction) => {
        if (datosActualizados.esCanalPorDefecto) {
            const q = canalesRef.where('esCanalPorDefecto', '==', true);
            const snapshotDefecto = await transaction.get(q);
            snapshotDefecto.forEach(doc => {
                if (doc.id !== canalId) {
                    transaction.update(doc.ref, { esCanalPorDefecto: false });
                }
            });
        }

        transaction.update(canalRef, {
            ...datosActualizados,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        });

        return { id: canalId, ...datosActualizados };
    });
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