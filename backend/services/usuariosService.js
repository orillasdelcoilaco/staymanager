const admin = require('firebase-admin');

const listarUsuariosPorEmpresa = async (db, empresaId) => {
    const usersSnapshot = await db.collection('empresas').doc(empresaId).collection('users').get();
    if (usersSnapshot.empty) {
        return [];
    }
    return usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
};

const crearUsuario = async (admin, db, { empresaId, email, password }) => {
    if (!email || !password) {
        throw new Error('Email y contraseña son requeridos.');
    }

    const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: email,
    });

    const userRef = db.collection('empresas').doc(empresaId).collection('users').doc(userRecord.uid);
    const nuevoUsuario = {
        email: userRecord.email,
        rol: 'admin',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        uid: userRecord.uid
    };
    await userRef.set(nuevoUsuario);

    console.log(`Nuevo usuario "${email}" creado para la empresa ${empresaId}.`);
    return nuevoUsuario;
};

const eliminarUsuario = async (admin, db, { empresaId, uid }) => {
    if (!uid) {
        throw new Error('Se requiere el UID del usuario a eliminar.');
    }
    
    const userRef = db.collection('empresas').doc(empresaId).collection('users').doc(uid);
    
    await admin.auth().deleteUser(uid);
    await userRef.delete();

    console.log(`Usuario con UID "${uid}" eliminado de la empresa ${empresaId}.`);
};


module.exports = {
    listarUsuariosPorEmpresa,
    crearUsuario,
    eliminarUsuario
};