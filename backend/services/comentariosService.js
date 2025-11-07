// backend/services/comentariosService.js
const admin = require('firebase-admin');
const { uploadFileToStorage, deleteFileFromStorage } = require('./storageService'); // Asumimos que este servicio existe

/**
 * Busca reservas que coincidan con un canal y un término de búsqueda.
 */
const buscarReservaParaComentario = async (db, empresaId, canalId, termino) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    // Buscamos por ID de reserva del canal (ej. "12345678" de Booking)
    const q = reservasRef
        .where('canalId', '==', canalId)
        .where('idReservaCanal', '>=', termino)
        .where('idReservaCanal', '<=', termino + '\uf8ff')
        .limit(10);

    const snapshot = await q.get();
    if (snapshot.empty) return [];

    // Mapear resultados y añadir info del cliente
    const reservasPromises = snapshot.docs.map(async (doc) => {
        const reserva = doc.data();
        let clienteNombre = 'Cliente no encontrado';
        if (reserva.clienteId) {
            const clienteDoc = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reserva.clienteId).get();
            if (clienteDoc.exists) {
                clienteNombre = clienteDoc.data().nombre;
            }
        }
        return {
            id: doc.id, // ID de la reserva en Firestore
            idReservaCanal: reserva.idReservaCanal,
            alojamientoNombre: reserva.alojamientoNombre,
            fechaLlegada: reserva.fechaLlegada.toDate().toISOString().split('T')[0],
            clienteId: reserva.clienteId,
            clienteNombre: clienteNombre
        };
    });

    return Promise.all(reservasPromises);
};

/**
 * Crea un nuevo documento de comentario en Firestore y sube las fotos.
 */
const crearComentario = async (db, empresaId, comentarioData, files) => {
    const { reservaId, clienteId, clienteNombre, alojamientoNombre, canalId, idReservaCanal, fecha, comentario, nota } = comentarioData;

    if (!reservaId || !clienteNombre || !fecha || !comentario || !nota) {
        throw new Error("Faltan datos requeridos (reserva, cliente, fecha, comentario, nota).");
    }

    // 1. Subir fotos si existen
    let foto1Url = null;
    let foto2Url = null;
    const path = `empresas/${empresaId}/comentarios`;

    if (files.foto1 && files.foto1[0]) {
        foto1Url = await uploadFileToStorage(files.foto1[0], path);
    }
    if (files.foto2 && files.foto2[0]) {
        foto2Url = await uploadFileToStorage(files.foto2[0], path);
    }

    // 2. Crear el objeto para guardar
    const comentarioRef = db.collection('empresas').doc(empresaId).collection('comentarios').doc();
    const nuevoComentario = {
        id: comentarioRef.id,
        reservaId,
        clienteId: clienteId || null,
        clienteNombre,
        alojamientoNombre,
        canalId,
        idReservaCanal,
        fecha: admin.firestore.Timestamp.fromDate(new Date(fecha + 'T00:00:00Z')),
        comentario,
        nota: parseFloat(nota), // Guardamos la nota unificada (1-5)
        foto1Url,
        foto2Url,
        visibleEnWeb: false, // Por defecto, no visible
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    // 3. Guardar en Firestore
    await comentarioRef.set(nuevoComentario);
    return nuevoComentario;
};

/**
 * Obtiene todos los comentarios de la empresa.
 */
const obtenerComentarios = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('comentarios')
        .orderBy('fecha', 'desc')
        .get();
        
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            fecha: data.fecha.toDate().toISOString().split('T')[0]
        };
    });
};

/**
 * Elimina un comentario y sus fotos asociadas.
 */
const eliminarComentario = async (db, empresaId, comentarioId) => {
    const comentarioRef = db.collection('empresas').doc(empresaId).collection('comentarios').doc(comentarioId);
    const doc = await comentarioRef.get();
    if (!doc.exists) throw new Error("Comentario no encontrado");

    const data = doc.data();

    // Eliminar fotos de Storage (asumiendo que deleteFileFromStorage usa la URL)
    if (data.foto1Url) {
        await deleteFileFromStorage(data.foto1Url).catch(e => console.error("Error al borrar foto1:", e.message));
    }
    if (data.foto2Url) {
        await deleteFileFromStorage(data.foto2Url).catch(e => console.error("Error al borrar foto2:", e.message));
    }

    // Eliminar documento de Firestore
    await comentarioRef.delete();
};


module.exports = {
    buscarReservaParaComentario,
    crearComentario,
    obtenerComentarios,
    eliminarComentario
};