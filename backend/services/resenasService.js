// backend/services/resenasService.js
const pool = require('../db/postgres');

async function generarTokenParaReserva(empresaId, reservaId, propiedadId, nombreHuesped) {
    const existing = await pool.query(
        'SELECT id, token FROM resenas WHERE empresa_id = $1 AND reserva_id = $2 LIMIT 1',
        [empresaId, reservaId]
    );
    if (existing.rows.length > 0) return existing.rows[0].token;

    const { rows } = await pool.query(
        `INSERT INTO resenas (empresa_id, reserva_id, propiedad_id, nombre_huesped)
         VALUES ($1, $2, $3, $4) RETURNING token`,
        [empresaId, reservaId, propiedadId || null, nombreHuesped || null]
    );
    return rows[0].token;
}

async function obtenerPorToken(token) {
    const { rows } = await pool.query(
        `SELECT r.*, p.nombre AS propiedad_nombre,
                e.nombre AS empresa_nombre, e.google_maps_url,
                e.configuracion->>'logoUrl' AS logo_url,
                e.configuracion->>'primaryColor' AS primary_color
         FROM resenas r
         JOIN empresas e ON e.id = r.empresa_id
         LEFT JOIN propiedades p ON p.id = r.propiedad_id
         WHERE r.token = $1`,
        [token]
    );
    return rows[0] || null;
}

async function marcarTokenUsado(token) {
    await pool.query(
        'UPDATE resenas SET token_usado_at = NOW() WHERE token = $1 AND token_usado_at IS NULL',
        [token]
    );
}

async function guardarResena(token, datos) {
    const {
        punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
        punt_comunicacion, punt_equipamiento, punt_valor,
        texto_positivo, texto_negativo
    } = datos;

    const { rows } = await pool.query(
        `UPDATE resenas SET
            punt_general = $1, punt_limpieza = $2, punt_ubicacion = $3,
            punt_llegada = $4, punt_comunicacion = $5, punt_equipamiento = $6,
            punt_valor = $7, texto_positivo = $8, texto_negativo = $9,
            estado = 'pendiente'
         WHERE token = $10 AND punt_general IS NULL
         RETURNING id`,
        [punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
         punt_comunicacion, punt_equipamiento, punt_valor,
         texto_positivo || null, texto_negativo || null, token]
    );
    return rows[0] || null;
}

async function registrarClickGoogle(token) {
    await pool.query(
        'UPDATE resenas SET google_click_at = NOW() WHERE token = $1',
        [token]
    );
}

async function obtenerResenas(empresaId, { estado, propiedadId } = {}) {
    let sql = `
        SELECT r.*, p.nombre AS propiedad_nombre
        FROM resenas r
        LEFT JOIN propiedades p ON p.id = r.propiedad_id
        WHERE r.empresa_id = $1 AND r.punt_general IS NOT NULL`;
    const params = [empresaId];

    if (estado) { params.push(estado); sql += ` AND r.estado = $${params.length}`; }
    if (propiedadId) { params.push(propiedadId); sql += ` AND r.propiedad_id = $${params.length}`; }

    sql += ' ORDER BY r.created_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
}

async function obtenerResumen(empresaId) {
    const { rows } = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            ROUND(AVG(punt_general), 1)::float AS promedio_general,
            ROUND(AVG(punt_limpieza), 1)::float AS promedio_limpieza,
            ROUND(AVG(punt_ubicacion), 1)::float AS promedio_ubicacion,
            ROUND(AVG(punt_llegada), 1)::float AS promedio_llegada,
            ROUND(AVG(punt_comunicacion), 1)::float AS promedio_comunicacion,
            ROUND(AVG(punt_equipamiento), 1)::float AS promedio_equipamiento,
            ROUND(AVG(punt_valor), 1)::float AS promedio_valor,
            COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes
         FROM resenas
         WHERE empresa_id = $1 AND punt_general IS NOT NULL`,
        [empresaId]
    );
    return rows[0];
}

async function responderResena(id, empresaId, texto, autor) {
    const { rows } = await pool.query(
        `UPDATE resenas SET respuesta_texto = $1, respuesta_fecha = NOW(), respuesta_autor = $2
         WHERE id = $3 AND empresa_id = $4 RETURNING id`,
        [texto, autor, id, empresaId]
    );
    return rows[0] || null;
}

async function cambiarEstado(id, empresaId, estado) {
    const { rows } = await pool.query(
        `UPDATE resenas SET estado = $1 WHERE id = $2 AND empresa_id = $3 RETURNING id`,
        [estado, id, empresaId]
    );
    return rows[0] || null;
}

module.exports = {
    generarTokenParaReserva,
    obtenerPorToken,
    marcarTokenUsado,
    guardarResena,
    registrarClickGoogle,
    obtenerResenas,
    obtenerResumen,
    responderResena,
    cambiarEstado
};
