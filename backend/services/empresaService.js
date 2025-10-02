const admin = require('firebase-admin');

const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }

    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();

    if (!doc.exists) {
        throw new Error('La empresa no fue encontrada.');
    }

    return doc.data();
};

const actualizarDetallesEmpresa = async (db, empresaId, datos) => {
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }
    const empresaRef = db.collection('empresas').doc(empresaId);
    await empresaRef.update({
        ...datos,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
};

const obtenerProximoIdNumericoCarga = async (db, empresaId) => {
    const empresaRef = db.collection('empresas').doc(empresaId);

    return db.runTransaction(async (transaction) => {
        const empresaDoc = await transaction.get(empresaRef);
        if (!empresaDoc.exists) {
            throw new Error("La empresa no existe.");
        }
        const proximoId = (empresaDoc.data().proximoIdCargaNumerico || 0) + 1;
        
        transaction.update(empresaRef, { proximoIdCargaNumerico: proximoId });
        
        return proximoId;
    });
};


module.exports = {
    obtenerDetallesEmpresa,
    actualizarDetallesEmpresa,
    obtenerProximoIdNumericoCarga
};