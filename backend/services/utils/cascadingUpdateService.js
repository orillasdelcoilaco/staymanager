// backend/services/utils/cascadingUpdateService.js
const idUpdateManifest = require('../../config/idUpdateManifest');
const { updateGoogleContact } = require('../googleContactsService');
const { renameFileByUrl } = require('../storageService');

const actualizarIdReservaCanalEnCascada = async (db, empresaId, idReserva, idAntiguo, idNuevo) => {
    if (!idAntiguo || !idNuevo || idAntiguo === idNuevo) {
        throw new Error("Se requieren un ID antiguo y uno nuevo, y deben ser diferentes.");
    }

    const summary = {
        firestore: {},
        storage: { renombrados: 0, errores: 0 },
        googleContacts: { actualizado: false, mensaje: 'No fue necesario actualizar.' }
    };
    
    const reservaDoc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idReserva).get();
    if (!reservaDoc.exists) throw new Error("La reserva principal no fue encontrada.");
    const reservaData = reservaDoc.data();

    const clienteDoc = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();
    if (clienteDoc.exists && clienteDoc.data().googleContactSynced) {
        const clienteData = clienteDoc.data();
        const oldContactName = `${clienteData.nombre} ${reservaData.canalNombre} ${idAntiguo}`;
        const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').get();
        const canalNuevoNombre = canalesSnapshot.docs.find(doc => doc.id === reservaData.canalId)?.data().nombre || reservaData.canalNombre;

        const newContactData = { ...clienteData, canalNombre: canalNuevoNombre, idReservaCanal: idNuevo };
        try {
            const result = await updateGoogleContact(db, empresaId, oldContactName, newContactData);
            summary.googleContacts.actualizado = result.status === 'updated' || result.status === 'created';
            summary.googleContacts.mensaje = `Contacto en Google ${result.status}.`;
        } catch (error) {
            summary.googleContacts.mensaje = `Error al actualizar en Google: ${error.message}`;
        }
    }

    await db.runTransaction(async (transaction) => {
        const updatesToPerform = [];
        
        for (const item of idUpdateManifest) {
            const collectionRef = db.collection('empresas').doc(empresaId).collection(item.collection);
            const snapshot = await transaction.get(collectionRef.where(item.field, '==', idAntiguo));
            
            summary.firestore[item.collection] = snapshot.size;

            snapshot.forEach(doc => {
                const updateData = { [item.field]: idNuevo };
                if (item.collection === 'reservas') { 
                    const docData = doc.data();
                    updateData['idUnicoReserva'] = `${idNuevo}-${docData.alojamientoId}`;
                    updateData['edicionesManuales.idReservaCanal'] = true;
                }
                updatesToPerform.push({ ref: doc.ref, data: updateData });
            });
        }

        updatesToPerform.forEach(update => {
            transaction.update(update.ref, update.data);
        });
    });

    const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
    const transaccionesSnapshot = await transaccionesRef.where('reservaIdOriginal', '==', idNuevo).get();

    const batch = db.batch();
    for(const doc of transaccionesSnapshot.docs) {
        const transaccion = doc.data();
        if (transaccion.enlaceComprobante && transaccion.enlaceComprobante.includes(idAntiguo)) {
            try {
                const nuevaUrl = await renameFileByUrl(transaccion.enlaceComprobante, idNuevo);
                if (nuevaUrl !== transaccion.enlaceComprobante) {
                    batch.update(doc.ref, { enlaceComprobante: nuevaUrl });
                    summary.storage.renombrados++;
                }
            } catch (error) {
                summary.storage.errores++;
            }
        }
    }
    await batch.commit();

    return summary;
};

module.exports = {
    actualizarIdReservaCanalEnCascada
};