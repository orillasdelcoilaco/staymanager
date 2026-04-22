// backend/services/conversionesService.js
const pool = require('../db/postgres');

function mapearConversion(row) {
    if (!row) return null;
    return {
        id: row.id,
        alojamientoId: row.propiedad_id,
        canalId: row.canal_id,
        nombreExterno: row.nombre_externo,
        alojamientoNombre: row.nombre_externo
    };
}

const crearConversion = async (_db, empresaId, datos) => {
    if (!empresaId || !datos.canalId || !datos.nombreExterno) {
        throw new Error('Faltan datos requeridos para crear la conversión.');
    }
    const { rows } = await pool.query(`
        INSERT INTO conversiones (empresa_id, canal_id, nombre_externo, propiedad_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (empresa_id, canal_id, nombre_externo) DO UPDATE SET
            propiedad_id = $4
        RETURNING *
    `, [empresaId, datos.canalId, datos.nombreExterno, datos.alojamientoId || null]);
    return mapearConversion(rows[0]);
};

const obtenerConversionesPorEmpresa = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT c.*, p.nombre AS alojamiento_nombre, ch.nombre AS canal_nombre
         FROM conversiones c
         LEFT JOIN propiedades p  ON p.id  = c.propiedad_id AND p.empresa_id  = c.empresa_id
         LEFT JOIN canales     ch ON ch.id = c.canal_id     AND ch.empresa_id = c.empresa_id
         WHERE c.empresa_id = $1
         ORDER BY c.nombre_externo ASC`,
        [empresaId]
    );
    return rows.map(r => ({
        id: r.id,
        alojamientoId: r.propiedad_id,
        canalId: r.canal_id,
        canalNombre: r.canal_nombre || null,
        nombreExterno: r.nombre_externo,
        alojamientoNombre: r.alojamiento_nombre || r.nombre_externo
    }));
};

const actualizarConversion = async (_db, empresaId, conversionId, datosActualizados) => {
    await pool.query(`
        UPDATE conversiones SET
            canal_id       = COALESCE($2, canal_id),
            nombre_externo = COALESCE($3, nombre_externo),
            propiedad_id   = COALESCE($4, propiedad_id)
        WHERE id = $1 AND empresa_id = $5
    `, [
        conversionId,
        datosActualizados.canalId       || null,
        datosActualizados.nombreExterno  || null,
        datosActualizados.alojamientoId  || null,
        empresaId
    ]);
    return { id: conversionId, ...datosActualizados };
};

const eliminarConversion = async (_db, empresaId, conversionId) => {
    await pool.query('DELETE FROM conversiones WHERE id = $1 AND empresa_id = $2', [conversionId, empresaId]);
};

module.exports = { crearConversion, obtenerConversionesPorEmpresa, actualizarConversion, eliminarConversion };
