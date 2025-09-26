const admin = require('firebase-admin');

const registrarCarga = async (db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    const historialRef = db.collection('empresas').doc(empresaId).collection('historialCargas');
    
    // Buscar si ya existe un registro para este nombre de archivo
    const q = historialRef.where('nombreArchivo', '==', nombreArchivo);
    const snapshot = await q.get();

    if (!snapshot.empty) {
        // Si existe, actualizamos la fecha y el usuario y devolvemos el ID existente
        const docExistente = snapshot.docs[0];
        await docExistente.ref.update({
            fechaCarga: admin.firestore.FieldValue.serverTimestamp(),
            usuarioEmail: usuarioEmail
        });
        console.log(`Registro de carga para el archivo "${nombreArchivo}" actualizado.`);
        return docExistente.id;
    } else {
        // Si no existe, creamos un nuevo documento con un ID único
        const docRef = historialRef.doc();
        const datosCarga = {
            id: docRef.id,
            nombreArchivo,
            canalId,
            usuarioEmail,
            fechaCarga: admin.firestore.FieldValue.serverTimestamp()
        };
        await docRef.set(datosCarga);
        console.log(`Nuevo registro de carga para el archivo "${nombreArchivo}" creado con ID único.`);
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
            id: doc.id, // El ID único del documento
            ...data,
            fechaCarga: data.fechaCarga.toDate().toLocaleString('es-CL')
        };
    });
};

module.exports = {
    registrarCarga,
    obtenerHistorialPorEmpresa
};