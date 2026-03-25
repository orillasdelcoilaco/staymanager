// backend/services/resenasService.js
const pool = require('../db/postgres');

const ESTADOS_VALIDOS = ['sin_responder', 'respondida', 'ignorada'];

function mapearResena(row) {
    return {
        id: row.id,
        empresaId: row.empresa_id,
        propiedadId: row.propiedad_id,
        propiedadNombre: row.propiedad_nombre || null,
        canal: row.canal,
        idExterno: row.id_externo,
        reviewerNombre: row.reviewer_nombre,
        texto: row.texto,
        respuesta: row.respuesta,
        rating: row.rating ? parseFloat(row.rating) : null,
        fechaReview: row.fecha_review,
        estado: row.estado,
        createdAt: row.created_at
    };
}

const obtenerResenas = async (empresaId, { estado, propiedadId, canal, limite = 50, offset = 0 } = {}) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const condiciones = ['r.empresa_id = $1'];
    const params = [empresaId];
    let i = 2;

    if (estado) { condiciones.push(`r.estado = $${i++}`); params.push(estado); }
    if (propiedadId) { condiciones.push(`r.propiedad_id = $${i++}`); params.push(propiedadId); }
    if (canal) { condiciones.push(`r.canal = $${i++}`); params.push(canal); }

    params.push(limite, offset);

    const { rows } = await pool.query(`
        SELECT r.*, p.nombre AS propiedad_nombre
        FROM resenas r
        LEFT JOIN propiedades p ON p.id = r.propiedad_id AND p.empresa_id = r.empresa_id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY r.fecha_review DESC NULLS LAST
        LIMIT $${i++} OFFSET $${i}
    `, params);

    return rows.map(mapearResena);
};

const obtenerResumenResenas = async (empresaId) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const { rows } = await pool.query(`
        SELECT
            COUNT(*)                                          AS total,
            COUNT(*) FILTER (WHERE estado = 'sin_responder') AS pendientes,
            ROUND(AVG(rating), 1)                            AS rating_promedio,
            canal,
            COUNT(*) FILTER (WHERE fecha_review >= NOW() - INTERVAL '30 days') AS ultimos_30_dias
        FROM resenas
        WHERE empresa_id = $1
        GROUP BY canal
        ORDER BY total DESC
    `, [empresaId]);

    return rows;
};

const guardarResena = async (empresaId, datos) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const { rows } = await pool.query(`
        INSERT INTO resenas
            (empresa_id, propiedad_id, canal, id_externo, reviewer_nombre, texto, rating, fecha_review, raw_email)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (empresa_id, canal, id_externo) DO NOTHING
        RETURNING *
    `, [
        empresaId,
        datos.propiedadId || null,
        datos.canal,
        datos.idExterno,
        datos.reviewerNombre || null,
        datos.texto || null,
        datos.rating || null,
        datos.fechaReview || null,
        datos.rawEmail ? JSON.stringify(datos.rawEmail) : '{}'
    ]);

    return rows[0] ? { nueva: true, resena: mapearResena(rows[0]) }
                   : { nueva: false, resena: null };
};

const responderResena = async (empresaId, resenaId, textoRespuesta) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const { rows } = await pool.query(`
        UPDATE resenas
        SET respuesta = $1, estado = 'respondida'
        WHERE id = $2 AND empresa_id = $3
        RETURNING *
    `, [textoRespuesta, resenaId, empresaId]);

    if (!rows[0]) throw new Error('Reseña no encontrada');
    return mapearResena(rows[0]);
};

const cambiarEstado = async (empresaId, resenaId, estado) => {
    if (!ESTADOS_VALIDOS.includes(estado)) {
        throw new Error(`Estado inválido. Válidos: ${ESTADOS_VALIDOS.join(', ')}`);
    }

    const { rows } = await pool.query(`
        UPDATE resenas SET estado = $1
        WHERE id = $2 AND empresa_id = $3
        RETURNING *
    `, [estado, resenaId, empresaId]);

    if (!rows[0]) throw new Error('Reseña no encontrada');
    return mapearResena(rows[0]);
};

module.exports = {
    obtenerResenas,
    obtenerResumenResenas,
    guardarResena,
    responderResena,
    cambiarEstado
};
