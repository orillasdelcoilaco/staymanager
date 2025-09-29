const admin = require('firebase-admin');
const { obtenerProximoIdNumericoCarga } = require('./empresaService');

const registrarCarga = async (db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    const historialRef = db.collection('empresas').doc(empresaId).collection('historialCargas');
    
    const q = historialRef.where('nombreArchivo', '==', nombreArchivo).limit(1);
    const snapshot = await q.get();

    if (!snapshot.empty) {
        const docExistente = snapshot.docs[0];
        await docExistente.ref.update({
            fechaCarga: admin.firestore.FieldValue.serverTimestamp(),
            usuarioEmail: usuarioEmail
        });
        console.log(`Registro de carga para el archivo "${nombreArchivo}" actualizado.`);
        return docExistente.id;
    } else {
        const proximoIdNumerico = await obtenerProximoIdNumericoCarga(db, empresaId);
        
        const docRef = historialRef.doc();
        const datosCarga = {
            id: docRef.id,
            idNumerico: proximoIdNumerico, // <-- Guardamos el nuevo ID numérico
            nombreArchivo,
            canalId,
            usuarioEmail,
            fechaCarga: admin.firestore.FieldValue.serverTimestamp()
        };
        await docRef.set(datosCarga);
        console.log(`Nuevo registro de carga para "${nombreArchivo}" creado con ID numérico ${proximoIdNumerico}.`);
        return docRef.id;
    }
};

const obtenerHistorialPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('historialCargas')
        .orderBy('fechaCarga', 'desc')
        .get();
        
    if (snapshot.empty) {
        return [];
    }
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fechaCarga: data.fechaCarga.toDate().toISOString()
        };
    });
};

module.exports = {
    registrarCarga,
    obtenerHistorialPorEmpresa
};