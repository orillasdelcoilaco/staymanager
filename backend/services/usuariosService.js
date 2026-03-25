// backend/services/usuariosService.js
const pool = require('../db/postgres');
const adminFirebase = require('firebase-admin');

const listarUsuariosPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM usuarios WHERE empresa_id = $1 ORDER BY created_at ASC',
            [empresaId]
        );
        return rows.map(r => ({
            uid: r.id,
            email: r.email,
            nombre: r.nombre,
            rol: r.rol,
            activo: r.activo,
            fechaCreacion: r.created_at
        }));
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('users').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
};

const crearUsuario = async (admin, db, { empresaId, email, password }) => {
    if (!email || !password) throw new Error('Email y contraseña son requeridos.');

    const userRecord = await admin.auth().createUser({ email, password, displayName: email });

    if (pool) {
        await pool.query(
            'INSERT INTO usuarios (id, empresa_id, email, rol) VALUES ($1, $2, $3, $4)',
            [userRecord.uid, empresaId, userRecord.email, 'admin']
        );
        console.log(`Nuevo usuario "${email}" creado para empresa ${empresaId}.`);
        return { uid: userRecord.uid, email: userRecord.email, rol: 'admin' };
    }

    // Firestore fallback
    const userRef = db.collection('empresas').doc(empresaId).collection('users').doc(userRecord.uid);
    const nuevoUsuario = {
        email: userRecord.email,
        rol: 'admin',
        fechaCreacion: adminFirebase.firestore.FieldValue.serverTimestamp(),
        uid: userRecord.uid
    };
    await userRef.set(nuevoUsuario);
    console.log(`Nuevo usuario "${email}" creado para empresa ${empresaId}.`);
    return nuevoUsuario;
};

const actualizarUsuario = async (admin, db, { empresaId, uid, datos }) => {
    if (!uid) throw new Error('El UID es obligatorio.');

    if (datos.password) {
        await admin.auth().updateUser(uid, { password: datos.password });
    }

    if (pool) {
        if (datos.rol) {
            await pool.query(
                'UPDATE usuarios SET rol = $1, updated_at = NOW() WHERE id = $2 AND empresa_id = $3',
                [datos.rol, uid, empresaId]
            );
        }
        return { uid, message: 'Usuario actualizado correctamente.' };
    }

    // Firestore fallback
    const updates = {};
    if (datos.rol) updates.rol = datos.rol;
    if (Object.keys(updates).length > 0) {
        await db.collection('empresas').doc(empresaId).collection('users').doc(uid).update(updates);
    }
    return { uid, message: 'Usuario actualizado correctamente.' };
};

const eliminarUsuario = async (admin, db, { empresaId, uid }) => {
    if (!uid) throw new Error('Se requiere el UID del usuario a eliminar.');

    await admin.auth().deleteUser(uid);

    if (pool) {
        await pool.query(
            'DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2',
            [uid, empresaId]
        );
        console.log(`Usuario "${uid}" eliminado de empresa ${empresaId}.`);
        return;
    }

    // Firestore fallback
    await db.collection('empresas').doc(empresaId).collection('users').doc(uid).delete();
    console.log(`Usuario "${uid}" eliminado de empresa ${empresaId}.`);
};

module.exports = {
    listarUsuariosPorEmpresa,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario
};
