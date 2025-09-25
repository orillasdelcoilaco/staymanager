const admin = require('firebase-admin');

const registrarCarga = async (db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    const historialRef = db.collection('empresas').doc(empresaId).collection('historialCargas');
    
    // Usamos el nombre del archivo como ID para evitar duplicados
    const docRef = historialRef.doc(nombreArchivo);

    const datosCarga = {
        nombreArchivo,
        canalId,
        usuarioEmail,
        fechaCarga: admin.firestore.FieldValue.serverTimestamp()
    };

    // set con merge:true crea el documento si no existe, o lo actualiza si ya existe
    await docRef.set(datosCarga, { merge: true });
    
    console.log(`Registro de carga para el archivo "${nombreArchivo}" creado/actualizado.`);
    return docRef.id; // El ID será el mismo nombre del archivo
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
            fechaCarga: data.fechaCarga.toDate().toLocaleString('es-CL')
        };
    });
};

module.exports = {
    registrarCarga,
    obtenerHistorialPorEmpresa
};