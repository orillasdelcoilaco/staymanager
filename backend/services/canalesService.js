// backend/services/canalesService.js
const pool = require('../db/postgres');

function mapearCanal(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo,
        comision: parseFloat(row.comision || 0),
        activo: row.activo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.metadata || {})
    };
}

const crearCanal = async (_db, empresaId, datosCanal) => {
    if (!empresaId || !datosCanal.nombre) {
        throw new Error('El ID de la empresa y el nombre del canal son requeridos.');
    }
    if (datosCanal.esCanalPorDefecto) {
        await pool.query(
            `UPDATE canales SET metadata = metadata || '{"esCanalPorDefecto": false}'::jsonb
             WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true`,
            [empresaId]
        );
    }
    const { nombre, tipo, comision, ...resto } = datosCanal;
    const { rows } = await pool.query(`
        INSERT INTO canales (empresa_id, nombre, tipo, comision, activo, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [empresaId, nombre, tipo || null, comision || 0, true, JSON.stringify(resto)]);
    return mapearCanal(rows[0]);
};

const obtenerCanalesPorEmpresa = async (_db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT * FROM canales WHERE empresa_id = $1 ORDER BY nombre ASC',
        [empresaId]
    );
    return rows.map(mapearCanal);
};

const actualizarCanal = async (_db, empresaId, canalId, datosActualizados) => {
    if (datosActualizados.esCanalPorDefecto) {
        await pool.query(
            `UPDATE canales SET metadata = metadata || '{"esCanalPorDefecto": false}'::jsonb
             WHERE empresa_id = $1 AND id != $2 AND (metadata->>'esCanalPorDefecto')::boolean = true`,
            [empresaId, canalId]
        );
    }
    const { nombre, tipo, comision, activo, ...resto } = datosActualizados;
    await pool.query(`
        UPDATE canales SET
            nombre     = COALESCE($2, nombre),
            tipo       = COALESCE($3, tipo),
            comision   = COALESCE($4, comision),
            activo     = COALESCE($5, activo),
            metadata   = metadata || $6::jsonb,
            updated_at = NOW()
        WHERE id = $1 AND empresa_id = $7
    `, [
        canalId,
        nombre   || null,
        tipo     || null,
        comision !== undefined ? comision : null,
        activo   !== undefined ? activo   : null,
        JSON.stringify(resto),
        empresaId
    ]);
    return { id: canalId, ...datosActualizados };
};

const eliminarCanal = async (_db, empresaId, canalId) => {
    await pool.query('DELETE FROM canales WHERE id = $1 AND empresa_id = $2', [canalId, empresaId]);
};

module.exports = { crearCanal, obtenerCanalesPorEmpresa, actualizarCanal, eliminarCanal };
