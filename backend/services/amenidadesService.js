// backend/services/amenidadesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

const obtenerTipos = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT id, nombre, icono, categoria, descripcion FROM tipos_amenidad WHERE empresa_id = $1 ORDER BY categoria, nombre',
            [empresaId]
        );
        return rows;
    }
    const snapshot = await db.collection('empresas').doc(empresaId)
        .collection('tiposAmenidad').orderBy('categoria').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const crearTipo = async (db, empresaId, datos) => {
    if (!datos.nombre || !datos.categoria) throw new Error('Nombre y categoría son obligatorios');

    if (pool) {
        const { rows } = await pool.query(
            `INSERT INTO tipos_amenidad (empresa_id, nombre, icono, categoria, descripcion)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [empresaId, datos.nombre, datos.icono || '✨', datos.categoria, datos.descripcion || '']
        );
        return { id: rows[0].id, nombre: datos.nombre, icono: datos.icono || '✨', categoria: datos.categoria, descripcion: datos.descripcion || '' };
    }

    const ref = db.collection('empresas').doc(empresaId).collection('tiposAmenidad').doc();
    const nuevoTipo = {
        id: ref.id,
        nombre: datos.nombre,
        icono: datos.icono || '✨',
        categoria: datos.categoria,
        descripcion: datos.descripcion || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(nuevoTipo);
    return nuevoTipo;
};

const eliminarTipo = async (db, empresaId, tipoId) => {
    if (pool) {
        await pool.query('DELETE FROM tipos_amenidad WHERE id = $1 AND empresa_id = $2', [tipoId, empresaId]);
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('tiposAmenidad').doc(tipoId).delete();
};

module.exports = { obtenerTipos, crearTipo, eliminarTipo };
