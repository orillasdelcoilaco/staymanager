// backend/services/transaccionesService.js
const admin = require('firebase-admin');
const { deleteFileByUrl, uploadFile } = require('./storageService');
const path = require('path');

const registrarPago = async (db, empresaId, detalles) => {
    const { idsIndividuales, monto, medioDePago, esPagoFinal, enlaceComprobante, reservaIdOriginal } = detalles;
    
    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const nuevaTransaccion = {
        reservaIdOriginal,
        monto: parseFloat(monto),
        medioDePago,
        tipo: esPagoFinal ? 'Pago Final' : 'Abono',
        fecha: admin.firestore.FieldValue.serverTimestamp(),
        enlaceComprobante: enlaceComprobante || null
    };
    await transaccionesRef.add(nuevaTransaccion);

    const batch = db.batch();
    if (esPagoFinal) {
        idsIndividuales.forEach(id => {
            const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
            batch.update(ref, { estadoGestion: 'Pendiente Boleta' });
        });
        await batch.commit();
    }
};

const eliminarPago = async (db, empresaId, transaccionId) => {
    const transaccionRef = db.collection('empresas').doc(empresaId).collection('transacciones').doc(transaccionId);
    
    const transaccionDoc = await transaccionRef.get();
    if (!transaccionDoc.exists) {
        throw new Error('La transacción a eliminar no fue encontrada.');
    }
    const transaccionData = transaccionDoc.data();

    if (transaccionData.enlaceComprobante && transaccionData.enlaceComprobante !== 'SIN_DOCUMENTO') {
        await deleteFileByUrl(transaccionData.enlaceComprobante).catch(err => console.error(`Fallo al eliminar archivo de storage: ${err.message}`));
    }
    
    await transaccionRef.delete();

    if (transaccionData.tipo === 'Pago Final') {
        const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
        const q = reservasRef.where('idReservaCanal', '==', transaccionData.reservaIdOriginal);
        const snapshot = await q.get();

        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { estadoGestion: 'Pendiente Pago' });
            });
            await batch.commit();
        }
    }
};

module.exports = {
    registrarPago,
    eliminarPago
};