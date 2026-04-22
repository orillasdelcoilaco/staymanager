// backend/services/usuariosService.js
const pool = require('../db/postgres');

const listarUsuariosPorEmpresa = async (_db, empresaId) => {
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
};

const crearUsuario = async (admin, _db, { empresaId, email, password }) => {
    if (!email || !password) throw new Error('Email y contraseña son requeridos.');
    const userRecord = await admin.auth().createUser({ email, password, displayName: email });
    await pool.query(
        'INSERT INTO usuarios (id, empresa_id, email, rol) VALUES ($1, $2, $3, $4)',
        [userRecord.uid, empresaId, userRecord.email, 'admin']
    );
    console.log(`Nuevo usuario "${email}" creado para empresa ${empresaId}.`);
    return { uid: userRecord.uid, email: userRecord.email, rol: 'admin' };
};

const actualizarUsuario = async (admin, _db, { empresaId, uid, datos }) => {
    if (!uid) throw new Error('El UID es obligatorio.');
    if (datos.password) {
        await admin.auth().updateUser(uid, { password: datos.password });
    }
    if (datos.rol) {
        await pool.query(
            'UPDATE usuarios SET rol = $1, updated_at = NOW() WHERE id = $2 AND empresa_id = $3',
            [datos.rol, uid, empresaId]
        );
    }
    return { uid, message: 'Usuario actualizado correctamente.' };
};

const eliminarUsuario = async (admin, _db, { empresaId, uid }) => {
    if (!uid) throw new Error('Se requiere el UID del usuario a eliminar.');
    await admin.auth().deleteUser(uid);
    await pool.query(
        'DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2',
        [uid, empresaId]
    );
    console.log(`Usuario "${uid}" eliminado de empresa ${empresaId}.`);
};

module.exports = { listarUsuariosPorEmpresa, crearUsuario, actualizarUsuario, eliminarUsuario };
