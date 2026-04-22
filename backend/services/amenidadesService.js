// backend/services/amenidadesService.js
const pool = require('../db/postgres');

const obtenerTipos = async (_db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT id, nombre, icono, categoria, descripcion FROM tipos_amenidad WHERE empresa_id = $1 ORDER BY categoria, nombre',
        [empresaId]
    );
    return rows;
};

const crearTipo = async (_db, empresaId, datos) => {
    if (!datos.nombre || !datos.categoria) throw new Error('Nombre y categoría son obligatorios');
    const { rows } = await pool.query(
        `INSERT INTO tipos_amenidad (empresa_id, nombre, icono, categoria, descripcion)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [empresaId, datos.nombre, datos.icono || '✨', datos.categoria, datos.descripcion || '']
    );
    return { id: rows[0].id, nombre: datos.nombre, icono: datos.icono || '✨', categoria: datos.categoria, descripcion: datos.descripcion || '' };
};

const eliminarTipo = async (_db, empresaId, tipoId) => {
    await pool.query('DELETE FROM tipos_amenidad WHERE id = $1 AND empresa_id = $2', [tipoId, empresaId]);
};

module.exports = { obtenerTipos, crearTipo, eliminarTipo };
