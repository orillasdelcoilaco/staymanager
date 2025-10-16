// backend/services/historialCargasService.js
const admin = require('firebase-admin');
const { obtenerProximoIdNumericoCarga } = require('./empresaService');
const { deleteFileByUrl } = require('./storageService');

const registrarCarga = async (db, empresaId, canalId, nombreArchivo, usuarioEmail) => {
    const historialRef = db.collection('empresas').doc(empresaId).collection('historialCargas');
    
    const q = historialRef.where('nombreArchivo', '==', nombreArchivo).limit(1);
    const snapshot = await q.get();

    if (!snapshot.empty) {
        const docExistente = snapshot.docs[0];
        await docExistente.ref.update({
            fechaCarga: admin.firestore.FieldValue.serverTimestamp(),
            usuarioEmail: usuarioEmail
        });
        console.log(`Registro de carga para el archivo "${nombreArchivo}" actualizado.`);
        return docExistente.id;
    } else {
        const proximoIdNumerico = await obtenerProximoIdNumericoCarga(db, empresaId);
        
        const docRef = historialRef.doc();
        const datosCarga = {
            id: docRef.id,
            idNumerico: proximoIdNumerico,
            nombreArchivo,
            canalId,
            usuarioEmail,
            fechaCarga: admin.firestore.FieldValue.serverTimestamp()
        };
        await docRef.set(datosCarga);
        console.log(`Nuevo registro de carga para "${nombreArchivo}" creado con ID numérico ${proximoIdNumerico}.`);
        return docRef.id;
    }
};

const obtenerHistorialPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('historialCargas')
        .orderBy('fechaCarga', 'desc')
        .get();
        
    if (snapshot.empty) {
        return [];
    }
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fechaCarga: data.fechaCarga.toDate().toISOString()
        };
    });
};

const eliminarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();

    if (snapshot.empty) {
        return { eliminadas: 0, message: 'No se encontraron reservas para esta carga.' };
    }

    const batch = db.batch();
    const deletePromises = [];
    
    const reservaIdsOriginales = snapshot.docs.map(doc => doc.data().idReservaCanal);
    const uniqueReservaIds = [...new Set(reservaIdsOriginales)];

    const chunkSize = 30;
    for (let i = 0; i < uniqueReservaIds.length; i += chunkSize) {
        const chunk = uniqueReservaIds.slice(i, i + chunkSize);
        if (chunk.length > 0) {
            const transaccionesRef = db.collection('empresas').doc(empresaId).collection('transacciones');
            const transaccionesSnapshot = await transaccionesRef.where('reservaIdOriginal', 'in', chunk).get();

            transaccionesSnapshot.forEach(doc => {
                const transaccionData = doc.data();
                if (transaccionData.enlaceComprobante && transaccionData.enlaceComprobante !== 'SIN_DOCUMENTO') {
                    deletePromises.push(deleteFileByUrl(transaccionData.enlaceComprobante));
                }
                batch.delete(doc.ref);
            });
        }
    }

    snapshot.docs.forEach(doc => {
        const reservaData = doc.data();
        if (reservaData.documentos) {
            if (reservaData.documentos.enlaceReserva && reservaData.documentos.enlaceReserva !== 'SIN_DOCUMENTO') {
                deletePromises.push(deleteFileByUrl(reservaData.documentos.enlaceReserva));
            }
            if (reservaData.documentos.enlaceBoleta && reservaData.documentos.enlaceBoleta !== 'SIN_DOCUMENTO') {
                deletePromises.push(deleteFileByUrl(reservaData.documentos.enlaceBoleta));
            }
        }
        batch.delete(doc.ref);
    });
    
    await Promise.all(deletePromises);
    await batch.commit();

    return { eliminadas: snapshot.size };
};

const contarReservasPorIdCarga = async (db, empresaId, idCarga) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('idCarga', '==', idCarga).get();
    return { count: snapshot.size };
};

module.exports = {
    registrarCarga,
    obtenerHistorialPorEmpresa,
    eliminarReservasPorIdCarga,
    contarReservasPorIdCarga
};