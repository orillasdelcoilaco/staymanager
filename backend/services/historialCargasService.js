// backend/services/historialCargasService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { deleteFileByUrl } = require('./storageService');

const registrarCarga = async (db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    if (pool) {
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
    }

    // Firestore fallback
    const { obtenerProximoIdNumericoCarga } = require('./empresaService');
    const historialRef = db.collection('empresas').doc(empresaId).collection('historialCargas');
    const snapshot = await historialRef.where('nombreArchivo', '==', nombreArchivo).limit(1).get();
    if (!snapshot.empty) {
        const docExistente = snapshot.docs[0];
        await docExistente.ref.update({ fechaCarga: admin.firestore.FieldValue.serverTimestamp(), usuarioEmail });
        return docExistente.id;
    }
    const proximoIdNumerico = await obtenerProximoIdNumericoCarga(db, empresaId);
    const docRef = historialRef.doc();
    await docRef.set({ id: docRef.id, idNumerico: proximoIdNumerico, nombreArchivo, canalId, usuarioEmail, fechaCarga: admin.firestore.FieldValue.serverTimestamp() });
    return docRef.id;
};

const obtenerHistorialPorEmpresa = async (db, empresaId) => {
    if (pool) {
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
    }

    const snapshot = await db.collection('empresas').doc(empresaId).collection('historialCargas')
        .orderBy('fechaCarga', 'desc').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, fechaCarga: data.fechaCarga.toDate().toISOString() };
    });
};

const eliminarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    if (pool) {
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
    }

    // Firestore fallback
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();
    if (snapshot.empty) return { eliminadas: 0, message: 'No se encontraron reservas para esta carga.' };

    const batch = db.batch();
    const deletePromises = [];
    const uniqueReservaIds = [...new Set(snapshot.docs.map(doc => doc.data().idReservaCanal))];
    const chunkSize = 30;
    for (let i = 0; i < uniqueReservaIds.length; i += chunkSize) {
        const chunk = uniqueReservaIds.slice(i, i + chunkSize);
        if (chunk.length) {
            const transSnap = await db.collection('empresas').doc(empresaId).collection('transacciones')
                .where('reservaIdOriginal', 'in', chunk).get();
            transSnap.forEach(doc => {
                const data = doc.data();
                if (data.enlaceComprobante && data.enlaceComprobante !== 'SIN_DOCUMENTO')
                    deletePromises.push(deleteFileByUrl(data.enlaceComprobante));
                batch.delete(doc.ref);
            });
        }
    }
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.documentos) {
            if (data.documentos.enlaceReserva && data.documentos.enlaceReserva !== 'SIN_DOCUMENTO') deletePromises.push(deleteFileByUrl(data.documentos.enlaceReserva));
            if (data.documentos.enlaceBoleta && data.documentos.enlaceBoleta !== 'SIN_DOCUMENTO') deletePromises.push(deleteFileByUrl(data.documentos.enlaceBoleta));
        }
        batch.delete(doc.ref);
    });
    await Promise.all(deletePromises);
    await batch.commit();
    return { eliminadas: snapshot.size };
};

const contarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM reservas WHERE empresa_id = $1 AND id_carga = $2',
            [empresaId, idCarga]
        );
        return { count: rows[0].count };
    }
    const snapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idCarga', '==', idCarga).get();
    return { count: snapshot.size };
};

module.exports = { registrarCarga, obtenerHistorialPorEmpresa, eliminarReservasPorIdCarga, contarReservasPorIdCarga };
