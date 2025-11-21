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

// --- NUEVA FUNCIÓN ---
const actualizarUsuario = async (admin, db, { empresaId, uid, datos }) => {
    if (!uid) {
        throw new Error('El UID es obligatorio');
    }

    // 1. Actualizar en Firebase Auth (Contraseña)
    if (datos.password) {
        await admin.auth().updateUser(uid, {
            password: datos.password
        });
        console.log(`Contraseña actualizada para usuario ${uid}`);
    }

    // 2. Actualizar en Firestore (Si hubiera otros campos como rol)
    // Por ahora, el email es inmutable desde este panel y la contraseña no se guarda en BD.
    // Pero mantenemos la estructura por si a futuro editamos el rol.
    const updates = {};
    if (datos.rol) updates.rol = datos.rol;

    if (Object.keys(updates).length > 0) {
        const userRef = db.collection('empresas').doc(empresaId).collection('users').doc(uid);
        await userRef.update(updates);
    }

    return { uid, message: 'Usuario actualizado correctamente' };
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
    actualizarUsuario, // Exportamos la nueva función
    eliminarUsuario
};