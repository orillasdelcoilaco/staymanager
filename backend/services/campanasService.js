// backend/services/campanasService.js
const pool = require('../db/postgres');

// Mapea estado del dominio → columna de contador en PG
const ESTADO_A_COLUMNA = {
    Enviado:       'cnt_enviado',
    Respondio:     'cnt_respondio',
    NoInteresado:  'cnt_no_interesado',
    Reservo:       'cnt_reservo',
    SinRespuesta:  'cnt_sin_respuesta',
};

function _mapRowCampana(row) {
    return {
        id: row.id,
        nombre: row.nombre,
        segmento: row.segmento,
        mensaje: row.mensaje,
        autor: row.autor,
        totalEnviados: row.total_enviados,
        fechaCreacion: row.created_at,
        estados: {
            Enviado:      row.cnt_enviado,
            Respondio:    row.cnt_respondio,
            NoInteresado: row.cnt_no_interesado,
            Reservo:      row.cnt_reservo,
            SinRespuesta: row.cnt_sin_respuesta,
        },
    };
}

const crearCampanaYRegistrarInteracciones = async (db, empresaId, datosCampana) => {
    const { nombre, segmento, mensaje, clientes, autor } = datosCampana;
    if (!nombre || !segmento || !mensaje || !clientes || !autor) {
        throw new Error('Faltan datos para crear la campaña.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO campanas (empresa_id, nombre, segmento, mensaje, autor, total_enviados, cnt_enviado)
             VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
            [empresaId, nombre, segmento, mensaje, autor, clientes.length]
        );
        const campanaId = rows[0].id;
        for (const cliente of clientes) {
            await client.query(
                `INSERT INTO interacciones (empresa_id, campana_id, cliente_id, cliente_nombre, estado)
                 VALUES ($1,$2,$3,$4,'Enviado')`,
                [empresaId, campanaId, cliente.id, cliente.nombre]
            );
        }
        await client.query('COMMIT');
        return {
            id: campanaId, nombre, segmento, mensaje, autor,
            totalEnviados: clientes.length,
            estados: { Enviado: clientes.length, Respondio: 0, NoInteresado: 0, Reservo: 0, SinRespuesta: 0 }
        };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const actualizarEstadoInteraccion = async (db, empresaId, interaccionId, nuevoEstado) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            'SELECT estado, campana_id FROM interacciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
            [interaccionId, empresaId]
        );
        if (!rows[0]) throw new Error('La interacción no fue encontrada.');
        const estadoAntiguo = rows[0].estado;
        const campanaId = rows[0].campana_id;
        if (estadoAntiguo === nuevoEstado) { await client.query('COMMIT'); return; }

        const colAntiguo = ESTADO_A_COLUMNA[estadoAntiguo];
        const colNuevo   = ESTADO_A_COLUMNA[nuevoEstado];
        if (!colAntiguo || !colNuevo) throw new Error(`Estado inválido: ${nuevoEstado}`);

        await client.query(
            'UPDATE interacciones SET estado = $1, updated_at = NOW() WHERE id = $2',
            [nuevoEstado, interaccionId]
        );
        await client.query(
            `UPDATE campanas SET ${colAntiguo} = ${colAntiguo} - 1, ${colNuevo} = ${colNuevo} + 1, updated_at = NOW() WHERE id = $1`,
            [campanaId]
        );
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const obtenerCampanas = async (db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT * FROM campanas WHERE empresa_id = $1 ORDER BY created_at DESC',
        [empresaId]
    );
    return rows.map(_mapRowCampana);
};

const obtenerInteraccionesCampana = async (db, empresaId, campanaId) => {
    const { rows } = await pool.query(
        `SELECT id, campana_id, cliente_id, cliente_nombre, estado, created_at, updated_at
         FROM interacciones WHERE empresa_id = $1 AND campana_id = $2
         ORDER BY cliente_nombre`,
        [empresaId, campanaId]
    );
    return rows.map(r => ({
        id: r.id, campanaId: r.campana_id, clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre, estado: r.estado,
        fechaCreacion: r.created_at, fechaUltimaActualizacion: r.updated_at,
    }));
};

module.exports = {
    crearCampanaYRegistrarInteracciones, actualizarEstadoInteraccion,
    obtenerCampanas, obtenerInteraccionesCampana,
};
