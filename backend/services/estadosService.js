// backend/services/estadosService.js
const pool = require('../db/postgres');

/**
 * Semántica fija del producto (misma clave que `SEMANTICA_CONFIG` en frontend):
 * primer paso de gestión tras confirmar una reserva. El nombre visible lo define cada empresa en `estados_reserva`.
 */
const SEMANTICA_GESTION_INICIO_POST_CONFIRMACION = 'pendiente_bienvenida';

function mapearEstado(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        color: row.color,
        orden: row.orden,
        esGestion: row.es_gestion,
        semantica: row.semantica,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

const crearEstado = async (_db, empresaId, datosEstado) => {
    if (!empresaId || !datosEstado.nombre) throw new Error('El nombre del estado es requerido.');
    const { rows } = await pool.query(`
        INSERT INTO estados_reserva (empresa_id, nombre, color, orden, es_gestion, semantica)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [
        empresaId,
        datosEstado.nombre,
        datosEstado.color     || '#cccccc',
        datosEstado.orden     || 0,
        datosEstado.esGestion || false,
        datosEstado.semantica || null
    ]);
    return mapearEstado(rows[0]);
};

const obtenerEstados = async (_db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT * FROM estados_reserva WHERE empresa_id = $1 ORDER BY orden ASC',
        [empresaId]
    );
    return rows.map(mapearEstado);
};

const actualizarEstado = async (_db, empresaId, estadoId, datosActualizados) => {
    await pool.query(`
        UPDATE estados_reserva SET
            nombre     = COALESCE($2, nombre),
            color      = COALESCE($3, color),
            orden      = COALESCE($4, orden),
            es_gestion = COALESCE($5, es_gestion),
            semantica  = COALESCE($6, semantica),
            updated_at = NOW()
        WHERE id = $1 AND empresa_id = $7
    `, [
        estadoId,
        datosActualizados.nombre    || null,
        datosActualizados.color     || null,
        datosActualizados.orden     !== undefined ? datosActualizados.orden     : null,
        datosActualizados.esGestion !== undefined ? datosActualizados.esGestion : null,
        datosActualizados.semantica !== undefined ? datosActualizados.semantica : null,
        empresaId
    ]);
    return { id: estadoId, ...datosActualizados };
};

const eliminarEstado = async (_db, empresaId, estadoId) => {
    await pool.query(
        'DELETE FROM estados_reserva WHERE id = $1 AND empresa_id = $2',
        [estadoId, empresaId]
    );
};

/**
 * @param {string} empresaId
 * @param {string} semantica — clave de máquina (columna estados_reserva.semantica)
 * @returns {Promise<string|null>} — `nombre` a guardar en reservas.estado_gestion (el panel filtra por nombre)
 */
async function obtenerNombreEstadoGestionPorSemantica(empresaId, semantica) {
    if (!pool || !empresaId || !semantica) return null;
    const { rows } = await pool.query(
        `SELECT nombre FROM estados_reserva
         WHERE empresa_id = $1 AND es_gestion = true AND semantica = $2
         ORDER BY orden ASC NULLS LAST
         LIMIT 1`,
        [empresaId, semantica]
    );
    return rows[0]?.nombre || null;
}

/**
 * Nombre del estado de gestión inicial tras confirmar reserva (web, IA, presupuesto).
 * Resuelve por semántica; si la empresa no la tiene asignada, usa el primer estado de gestión por orden.
 */
async function obtenerNombreEstadoGestionInicialReservaConfirmada(empresaId) {
    let nombre = await obtenerNombreEstadoGestionPorSemantica(
        empresaId,
        SEMANTICA_GESTION_INICIO_POST_CONFIRMACION
    );
    if (nombre) return nombre;
    if (!pool || !empresaId) return null;
    const { rows } = await pool.query(
        `SELECT nombre FROM estados_reserva
         WHERE empresa_id = $1 AND es_gestion = true
         ORDER BY orden ASC NULLS LAST
         LIMIT 1`,
        [empresaId]
    );
    return rows[0]?.nombre || null;
}

module.exports = {
    crearEstado,
    obtenerEstados,
    actualizarEstado,
    eliminarEstado,
    obtenerNombreEstadoGestionPorSemantica,
    obtenerNombreEstadoGestionInicialReservaConfirmada,
    SEMANTICA_GESTION_INICIO_POST_CONFIRMACION,
};
