// backend/services/transaccionesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { deleteFileByUrl } = require('./storageService');

const registrarPago = async (db, empresaId, detalles) => {
    const { idsIndividuales, monto, medioDePago, esPagoFinal, enlaceComprobante, reservaIdOriginal } = detalles;

    if (pool) {
        await pool.query(
            `INSERT INTO transacciones (empresa_id, id_reserva_canal, tipo, monto, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                empresaId,
                reservaIdOriginal,
                esPagoFinal ? 'Pago Final' : 'Abono',
                parseFloat(monto),
                JSON.stringify({ medioDePago, enlaceComprobante: enlaceComprobante || null })
            ]
        );
        if (esPagoFinal && idsIndividuales?.length) {
            // Determine next gestión state (semantics-aware fallback: 'Pendiente Boleta')
            await pool.query(
                `UPDATE reservas SET estado_gestion = 'Pendiente Boleta', updated_at = NOW()
                 WHERE id = ANY($1) AND empresa_id = $2`,
                [idsIndividuales, empresaId]
            );
        }
        return;
    }

    // Firestore fallback
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    await transaccionesRef.add({
        reservaIdOriginal,
        monto: parseFloat(monto),
        medioDePago,
        tipo: esPagoFinal ? 'Pago Final' : 'Abono',
        fecha: admin.firestore.FieldValue.serverTimestamp(),
        enlaceComprobante: enlaceComprobante || null
    });
    if (esPagoFinal) {
        const batch = db.batch();
        idsIndividuales.forEach(id => {
            batch.update(db.collection('empresas').doc(empresaId).collection('reservas').doc(id), { estadoGestion: 'Pendiente Boleta' });
        });
        await batch.commit();
    }
};

const eliminarPago = async (db, empresaId, transaccionId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT tipo, metadata FROM transacciones WHERE id = $1 AND empresa_id = $2',
            [transaccionId, empresaId]
        );
        if (!rows[0]) throw new Error('La transacción a eliminar no fue encontrada.');
        const { tipo, metadata } = rows[0];
        const enlace = metadata?.enlaceComprobante;
        if (enlace && enlace !== 'SIN_DOCUMENTO') {
            await deleteFileByUrl(enlace).catch(err => console.error(`Fallo al eliminar comprobante: ${err.message}`));
        }
        await pool.query('DELETE FROM transacciones WHERE id = $1 AND empresa_id = $2', [transaccionId, empresaId]);
        if (tipo === 'Pago Final') {
            const idReservaCanal = rows[0].id_reserva_canal;
            if (idReservaCanal) {
                await pool.query(
                    `UPDATE reservas SET estado_gestion = 'Pendiente Pago', updated_at = NOW()
                     WHERE empresa_id = $1 AND id_reserva_canal = $2`,
                    [empresaId, idReservaCanal]
                );
            }
        }
        return;
    }

    // Firestore fallback
    const transaccionRef = db.collection('empresas').doc(empresaId).collection('transacciones').doc(transaccionId);
    const transaccionDoc = await transaccionRef.get();
    if (!transaccionDoc.exists) throw new Error('La transacción a eliminar no fue encontrada.');
    const transaccionData = transaccionDoc.data();
    if (transaccionData.enlaceComprobante && transaccionData.enlaceComprobante !== 'SIN_DOCUMENTO') {
        await deleteFileByUrl(transaccionData.enlaceComprobante).catch(err => console.error(`Fallo al eliminar archivo de storage: ${err.message}`));
    }
    await transaccionRef.delete();
    if (transaccionData.tipo === 'Pago Final') {
        const snapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
            .where('idReservaCanal', '==', transaccionData.reservaIdOriginal).get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.update(doc.ref, { estadoGestion: 'Pendiente Pago' }));
            await batch.commit();
        }
    }
};

module.exports = { registrarPago, eliminarPago };
