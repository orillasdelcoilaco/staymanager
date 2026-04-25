// backend/services/estadosService.js
const pool = require('../db/postgres');

/**
 * Semántica fija del producto (misma clave que `SEMANTICA_CONFIG` en frontend):
 * primer paso de gestión tras confirmar una reserva. El nombre visible lo define cada empresa en `estados_reserva`.
 */
const SEMANTICA_GESTION_INICIO_POST_CONFIRMACION = 'pendiente_bienvenida';

function _sqlQuoteLiteral(v) {
    return `'${String(v || '').replace(/'/g, "''")}'`;
}

function _sqlArrayLiterals(values) {
    const arr = Array.isArray(values) ? values : [values];
    return arr.map((v) => _sqlQuoteLiteral(v)).join(', ');
}

/**
 * Compatibilidad legacy: SQL WHERE para estado principal por semántica.
 * Usa estado_principal_id (nuevo) y fallback por nombre en reservas.estado (legacy).
 *
 * @param {string} semantica
 * @param {string} alias - alias de la tabla reservas (default "r")
 */
function sqlReservaPrincipalSemanticaIgual(semantica, alias = 'r') {
    const s = _sqlQuoteLiteral(semantica);
    // Compatible con esquemas sin estado_principal_id: resuelve por nombre/semántica.
    return `(
      LOWER(COALESCE(${alias}.estado, '')) IN (
        SELECT LOWER(er.nombre)
          FROM estados_reserva er
         WHERE er.empresa_id = ${alias}.empresa_id
           AND COALESCE(er.semantica, '') = ${s}
      )
      OR LOWER(COALESCE(${alias}.estado, '')) = LOWER(${s})
    )`;
}

/**
 * Compatibilidad legacy: SQL WHERE para varias semánticas.
 *
 * @param {string[]} semanticas
 * @param {string} alias
 */
function sqlReservaPrincipalSemanticaEn(semanticas, alias = 'r') {
    const valuesSql = _sqlArrayLiterals(semanticas);
    // Compatible con esquemas sin estado_principal_id: resuelve por nombre/semántica.
    return `(
      LOWER(COALESCE(${alias}.estado, '')) IN (
        SELECT LOWER(er.nombre)
          FROM estados_reserva er
         WHERE er.empresa_id = ${alias}.empresa_id
           AND COALESCE(er.semantica, '') IN (${valuesSql})
      )
      OR LOWER(COALESCE(${alias}.estado, '')) IN (${valuesSql})
    )`;
}

const _reservasColumnCache = { ts: 0, names: new Set() };
async function _loadReservasColumns() {
    if (!pool) return new Set();
    const now = Date.now();
    if (_reservasColumnCache.ts && now - _reservasColumnCache.ts < 60_000) {
        return _reservasColumnCache.names;
    }
    const { rows } = await pool.query(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'reservas'`
    );
    _reservasColumnCache.names = new Set(rows.map((r) => String(r.column_name)));
    _reservasColumnCache.ts = now;
    return _reservasColumnCache.names;
}

async function reservasTieneColumna(nombreColumna) {
    const cols = await _loadReservasColumns();
    return cols.has(String(nombreColumna || '').trim());
}

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

/**
 * Estado principal (tabla estados_reserva) por semántica.
 */
async function obtenerEstadoPrincipalRowPorSemantica(empresaId, semantica) {
    if (!pool || !empresaId || !semantica) return null;
    const { rows } = await pool.query(
        `SELECT id, nombre, semantica
           FROM estados_reserva
          WHERE empresa_id = $1
            AND COALESCE(semantica, '') = $2
          ORDER BY orden ASC NULLS LAST
          LIMIT 1`,
        [empresaId, semantica]
    );
    return rows[0] || null;
}

/**
 * Fila completa del estado de gestión inicial tras confirmación.
 */
async function obtenerEstadoGestionInicialPostConfirmacionRow(empresaId) {
    if (!pool || !empresaId) return null;
    let row = null;
    const bySem = await pool.query(
        `SELECT id, nombre, semantica
           FROM estados_reserva
          WHERE empresa_id = $1
            AND es_gestion = true
            AND COALESCE(semantica, '') = $2
          ORDER BY orden ASC NULLS LAST
          LIMIT 1`,
        [empresaId, SEMANTICA_GESTION_INICIO_POST_CONFIRMACION]
    );
    row = bySem.rows[0] || null;
    if (row) return row;

    const fallback = await pool.query(
        `SELECT id, nombre, semantica
           FROM estados_reserva
          WHERE empresa_id = $1
            AND es_gestion = true
          ORDER BY orden ASC NULLS LAST
          LIMIT 1`,
        [empresaId]
    );
    return fallback.rows[0] || null;
}

module.exports = {
    crearEstado,
    obtenerEstados,
    actualizarEstado,
    eliminarEstado,
    sqlReservaPrincipalSemanticaIgual,
    sqlReservaPrincipalSemanticaEn,
    reservasTieneColumna,
    obtenerEstadoPrincipalRowPorSemantica,
    obtenerEstadoGestionInicialPostConfirmacionRow,
    obtenerNombreEstadoGestionPorSemantica,
    obtenerNombreEstadoGestionInicialReservaConfirmada,
    SEMANTICA_GESTION_INICIO_POST_CONFIRMACION,
};
