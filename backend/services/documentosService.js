// backend/services/documentosService.js
const admin = require('firebase-admin');
const { deleteFileByUrl, uploadFile } = require('./storageService');
const path = require('path');

const actualizarDocumentoReserva = async (db, empresaId, idsIndividuales, tipoDocumento, url) => {
    const campo = tipoDocumento === 'boleta' ? 'documentos.enlaceBoleta' : 'documentos.enlaceReserva';

    if (url === null && idsIndividuales.length > 0) {
        const primeraReservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]);
        const primeraReservaDoc = await primeraReservaRef.get();
        if (primeraReservaDoc.exists) {
            const reservaData = primeraReservaDoc.data();
            const oldUrl = (tipoDocumento === 'boleta')
                ? reservaData.documentos?.enlaceBoleta
                : reservaData.documentos?.enlaceReserva;

            if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
                deleteFileByUrl(oldUrl).catch(err => console.error(`Fallo al eliminar archivo de storage: ${err.message}`));
            }
        }
    }

    const batch = db.batch();
    const updateData = {};
    if (url === null) {
        updateData[campo] = admin.firestore.FieldValue.delete();
    } else {
        updateData[campo] = url;
    }

    if (tipoDocumento === 'boleta' && (url || url === 'SIN_DOCUMENTO')) {
        updateData.estadoGestion = 'Pendiente Cliente';
    }

    idsIndividuales.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, updateData);
    });
    await batch.commit();
};

const gestionarDocumentoReserva = async (db, empresaId, reservaId, tipoDocumento, archivo, accion) => {
    const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId);
    const reservaDoc = await reservaRef.get();
    if (!reservaDoc.exists) {
        throw new Error("Reserva no encontrada");
    }

    const reservaData = reservaDoc.data();
    const campo = tipoDocumento === 'boleta' ? `documentos.enlaceBoleta` : `documentos.enlaceReserva`;
    const oldUrl = reservaData.documentos?.[tipoDocumento === 'boleta' ? 'enlaceBoleta' : 'enlaceReserva'];

    if (accion === 'delete') {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
            await deleteFileByUrl(oldUrl);
        }
        await reservaRef.update({ [campo]: admin.firestore.FieldValue.delete() });
    } else if (archivo) {
        if (oldUrl && oldUrl !== 'SIN_DOCUMENTO') {
            await deleteFileByUrl(oldUrl);
        }
        const year = new Date().getFullYear();
        const fileName = `${reservaData.idReservaCanal}_${tipoDocumento}_${Date.now()}${path.extname(archivo.originalname)}`;
        const destination = `empresas/${empresaId}/reservas/${year}/${fileName}`;
        const publicUrl = await uploadFile(archivo.buffer, destination, archivo.mimetype);
        await reservaRef.update({ [campo]: publicUrl });
    } else {
        throw new Error("Acción no válida o archivo no proporcionado.");
    }

    const docActualizado = await reservaRef.get();
    return docActualizado.data();
};


module.exports = {
    actualizarDocumentoReserva,
    gestionarDocumentoReserva
};