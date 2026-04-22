// backend/services/historialCargasService.js
const pool = require('../db/postgres');
const { deleteFileByUrl } = require('./storageService');

const registrarCarga = async (_db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    const { rows: ex } = await pool.query(
        'SELECT id FROM historial_cargas WHERE empresa_id = $1 AND nombre_archivo = $2 LIMIT 1',
        [empresaId, nombreArchivo]
    );
    if (ex[0]) {
        await pool.query(
            `UPDATE historial_cargas SET fecha_carga = NOW(), metadata = metadata || $2 WHERE id = $1`,
            [ex[0].id, JSON.stringify({ usuarioEmail })]
        );
        return ex[0].id;
    }
    const { rows } = await pool.query(
        `INSERT INTO historial_cargas (empresa_id, nombre_archivo, canal_id, metadata)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [empresaId, nombreArchivo, canalId || null, JSON.stringify({ usuarioEmail })]
    );
    return rows[0].id;
};

const obtenerHistorialPorEmpresa = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT h.id, h.id_numerico, h.nombre_archivo, h.canal_id, h.fecha_carga,
                h.total_procesadas, h.total_creadas, h.total_actualizadas, h.errores, h.metadata,
                c.nombre AS canal_nombre_rel
         FROM historial_cargas h
         LEFT JOIN canales c ON c.id = h.canal_id
         WHERE h.empresa_id = $1
         ORDER BY h.fecha_carga DESC`,
        [empresaId]
    );
    return rows.map(r => ({
        id: r.id,
        idNumerico: r.id_numerico,
        nombreArchivo: r.nombre_archivo,
        canalId: r.canal_id,
        canalNombre: r.canal_nombre_rel || r.metadata?.canalNombre || null,
        fechaCarga: r.fecha_carga?.toISOString(),
        totalProcesadas: r.total_procesadas || 0,
        totalCreadas: r.total_creadas || 0,
        totalActualizadas: r.total_actualizadas || 0,
        errores: r.errores || [],
    }));
};

const eliminarReservasPorIdCarga = async (_db, empresaId, idCarga) => {
    const { rows: reservas } = await pool.query(
        'SELECT id, id_reserva_canal, documentos FROM reservas WHERE empresa_id = $1 AND id_carga = $2',
        [empresaId, idCarga]
    );
    if (reservas.length === 0) return { eliminadas: 0, message: 'No se encontraron reservas para esta carga.' };

    const idsCanalUnicos = [...new Set(reservas.map(r => r.id_reserva_canal).filter(Boolean))];
    const { rows: trans } = idsCanalUnicos.length
        ? await pool.query(
            `SELECT metadata->>'enlaceComprobante' AS enlace FROM transacciones
             WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)`,
            [empresaId, idsCanalUnicos])
        : { rows: [] };

    const deletePromises = [];
    trans.forEach(t => {
        if (t.enlace && t.enlace !== 'SIN_DOCUMENTO') deletePromises.push(deleteFileByUrl(t.enlace));
    });
    reservas.forEach(r => {
        const docs = r.documentos || {};
        if (docs.enlaceReserva && docs.enlaceReserva !== 'SIN_DOCUMENTO') deletePromises.push(deleteFileByUrl(docs.enlaceReserva));
        if (docs.enlaceBoleta && docs.enlaceBoleta !== 'SIN_DOCUMENTO') deletePromises.push(deleteFileByUrl(docs.enlaceBoleta));
    });
    await Promise.all(deletePromises);

    if (idsCanalUnicos.length) {
        await pool.query('DELETE FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)', [empresaId, idsCanalUnicos]);
        await pool.query('DELETE FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)', [empresaId, idsCanalUnicos]);
    }
    // INTENCIONAL: clientes, propuestas y presupuestos NO se eliminan.
    // clientes: regla de negocio invariable.
    // propuestas/presupuestos: vinculados al cliente, no a la carga — deben sobrevivir el reimport.
    const { rowCount } = await pool.query('DELETE FROM reservas WHERE empresa_id = $1 AND id_carga = $2', [empresaId, idCarga]);
    return { eliminadas: rowCount };
};

const contarReservasPorIdCarga = async (_db, empresaId, idCarga) => {
    const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM reservas WHERE empresa_id = $1 AND id_carga = $2',
        [empresaId, idCarga]
    );
    return { count: rows[0].count };
};

module.exports = { registrarCarga, obtenerHistorialPorEmpresa, eliminarReservasPorIdCarga, contarReservasPorIdCarga };
