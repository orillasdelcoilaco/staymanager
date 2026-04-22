// backend/services/comentariosService.js
const pool = require('../db/postgres');
const { uploadFile, deleteFileByUrl } = require('./storageService');
const { v4: uuidv4 } = require('uuid');

const buscarReservaParaComentario = async (_db, empresaId, canalId, termino) => {
    const { rows } = await pool.query(
        `SELECT r.id, r.id_reserva_canal, r.propiedad_id, r.canal_id, r.alojamiento_nombre, r.canal_nombre,
                r.cliente_id, r.fecha_llegada, r.fecha_salida, c.nombre AS cliente_nombre
         FROM reservas r
         LEFT JOIN clientes c ON r.cliente_id = c.id AND c.empresa_id = r.empresa_id
         WHERE r.empresa_id = $1 AND r.canal_id = $2 AND r.id_reserva_canal ILIKE $3
         LIMIT 10`,
        [empresaId, canalId, `${termino}%`]
    );
    return rows.map(r => ({
        id: r.id,
        idReservaCanal: r.id_reserva_canal,
        alojamientoNombre: r.alojamiento_nombre,
        fechaLlegada: r.fecha_llegada instanceof Date ? r.fecha_llegada.toISOString().split('T')[0] : String(r.fecha_llegada),
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre || 'Cliente no encontrado',
    }));
};

const crearComentario = async (_db, empresaId, comentarioData, files) => {
    const { reservaId, clienteId, clienteNombre, alojamientoNombre, canalId, idReservaCanal, fecha, comentario, nota } = comentarioData;
    if (!reservaId || !clienteNombre || !fecha || !comentario || !nota) {
        throw new Error('Faltan datos requeridos (reserva, cliente, fecha, comentario, nota).');
    }

    let foto1Url = null, foto2Url = null;
    const storagePath = `empresas/${empresaId}/comentarios`;
    if (files.foto1?.[0]) {
        foto1Url = await uploadFile(files.foto1[0].buffer, `${storagePath}/${uuidv4()}_${files.foto1[0].originalname}`, files.foto1[0].mimetype);
    }
    if (files.foto2?.[0]) {
        foto2Url = await uploadFile(files.foto2[0].buffer, `${storagePath}/${uuidv4()}_${files.foto2[0].originalname}`, files.foto2[0].mimetype);
    }

    const { rows } = await pool.query(
        `INSERT INTO comentarios
         (empresa_id, reserva_id, cliente_id, cliente_nombre, alojamiento_nombre, canal_id, id_reserva_canal, fecha, comentario, nota, foto1_url, foto2_url, visible_en_web)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false) RETURNING id`,
        [empresaId, reservaId, clienteId || null, clienteNombre, alojamientoNombre, canalId, idReservaCanal, fecha, comentario, parseFloat(nota), foto1Url, foto2Url]
    );
    return { id: rows[0].id, reservaId, clienteId, clienteNombre, alojamientoNombre, canalId, idReservaCanal, fecha, comentario, nota: parseFloat(nota), foto1Url, foto2Url, visibleEnWeb: false };
};

const obtenerComentarios = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT id, reserva_id, cliente_id, cliente_nombre, alojamiento_nombre, canal_id, id_reserva_canal,
                fecha, comentario, nota, foto1_url, foto2_url, visible_en_web, created_at
         FROM comentarios WHERE empresa_id = $1 ORDER BY fecha DESC`,
        [empresaId]
    );
    return rows.map(r => ({
        id: r.id, reservaId: r.reserva_id, clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre, alojamientoNombre: r.alojamiento_nombre,
        canalId: r.canal_id, idReservaCanal: r.id_reserva_canal,
        fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
        comentario: r.comentario, nota: r.nota, foto1Url: r.foto1_url,
        foto2Url: r.foto2_url, visibleEnWeb: r.visible_en_web,
    }));
};

const eliminarComentario = async (_db, empresaId, comentarioId) => {
    const { rows } = await pool.query(
        'SELECT foto1_url, foto2_url FROM comentarios WHERE id = $1 AND empresa_id = $2',
        [comentarioId, empresaId]
    );
    if (!rows[0]) throw new Error('Comentario no encontrado');
    if (rows[0].foto1_url) await deleteFileByUrl(rows[0].foto1_url).catch(e => console.error('Error al borrar foto1:', e.message));
    if (rows[0].foto2_url) await deleteFileByUrl(rows[0].foto2_url).catch(e => console.error('Error al borrar foto2:', e.message));
    await pool.query('DELETE FROM comentarios WHERE id = $1 AND empresa_id = $2', [comentarioId, empresaId]);
};

module.exports = { buscarReservaParaComentario, crearComentario, obtenerComentarios, eliminarComentario };
