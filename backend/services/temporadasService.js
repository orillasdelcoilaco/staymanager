// backend/services/temporadasService.js
const pool = require('../db/postgres');

function mapearTemporada(row) {
    return {
        id:           row.id,
        empresaId:    row.empresa_id,
        nombre:       row.nombre,
        fechaInicio:  row.fecha_inicio instanceof Date
            ? row.fecha_inicio.toISOString().split('T')[0]
            : String(row.fecha_inicio),
        fechaTermino: row.fecha_termino instanceof Date
            ? row.fecha_termino.toISOString().split('T')[0]
            : String(row.fecha_termino),
    };
}

const obtenerTemporadasPorEmpresa = async (empresaId) => {
    const { rows } = await pool.query(
        `SELECT t.*, COUNT(ta.id)::int AS total_tarifas
         FROM temporadas t
         LEFT JOIN tarifas ta ON ta.temporada_id = t.id
         WHERE t.empresa_id = $1
         GROUP BY t.id
         ORDER BY t.fecha_inicio DESC`,
        [empresaId]
    );
    return rows.map(r => ({ ...mapearTemporada(r), totalTarifas: r.total_tarifas }));
};

const crearTemporada = async (empresaId, datos) => {
    const { nombre, fechaInicio, fechaTermino } = datos;
    if (!nombre || !fechaInicio || !fechaTermino) throw new Error('Faltan datos requeridos.');
    const { rows } = await pool.query(
        `INSERT INTO temporadas (empresa_id, nombre, fecha_inicio, fecha_termino)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [empresaId, nombre.trim(), fechaInicio, fechaTermino]
    );
    return { ...mapearTemporada(rows[0]), totalTarifas: 0 };
};

const actualizarTemporada = async (empresaId, temporadaId, datos) => {
    const { nombre, fechaInicio, fechaTermino } = datos;
    const { rows } = await pool.query(
        `UPDATE temporadas
         SET nombre = COALESCE($3, nombre),
             fecha_inicio  = COALESCE($4, fecha_inicio),
             fecha_termino = COALESCE($5, fecha_termino),
             updated_at = NOW()
         WHERE id = $1 AND empresa_id = $2 RETURNING *`,
        [temporadaId, empresaId, nombre || null, fechaInicio || null, fechaTermino || null]
    );
    if (!rows[0]) throw new Error('Temporada no encontrada.');
    return mapearTemporada(rows[0]);
};

const eliminarTemporada = async (empresaId, temporadaId) => {
    const { rows: tarifas } = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM tarifas WHERE temporada_id = $1',
        [temporadaId]
    );
    if (tarifas[0].cnt > 0) throw new Error('No se puede eliminar: la temporada tiene tarifas asignadas. Elimínalas primero.');
    const { rowCount } = await pool.query(
        'DELETE FROM temporadas WHERE id = $1 AND empresa_id = $2',
        [temporadaId, empresaId]
    );
    if (!rowCount) throw new Error('Temporada no encontrada.');
};

module.exports = { obtenerTemporadasPorEmpresa, crearTemporada, actualizarTemporada, eliminarTemporada };
