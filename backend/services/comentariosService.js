// backend/services/comentariosService.js
const admin = require('firebase-admin');
// --- INICIO DE LA MODIFICACIÓN ---
// Importamos los nombres de funciones correctos de tu storageService
const { uploadFile, deleteFileByUrl } = require('./storageService');
const { v4: uuidv4 } = require('uuid'); // Necesitamos uuid para nombres de archivo únicos
// --- FIN DE LA MODIFICACIÓN ---

/**
 * Busca reservas que coincidan con un canal y un término de búsqueda.
 */
const buscarReservaParaComentario = async (db, empresaId, canalId, termino) => {
    // ... (Esta función no cambia y sigue siendo correcta)
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    
    const q = reservasRef
        .where('canalId', '==', canalId)
        .where('idReservaCanal', '>=', termino)
        .where('idReservaCanal', '<=', termino + '\uf8ff')
        .limit(10);

    const snapshot = await q.get();
    if (snapshot.empty) return [];

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
            id: doc.id,
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

    // --- INICIO DE LA MODIFICACIÓN (Lógica de subida) ---
    let foto1Url = null;
    let foto2Url = null;
    const path = `empresas/${empresaId}/comentarios`;

    if (files.foto1 && files.foto1[0]) {
        const file = files.foto1[0];
        const destinationPath = `${path}/${uuidv4()}_${file.originalname}`;
        foto1Url = await uploadFile(file.buffer, destinationPath, file.mimetype);
    }
    if (files.foto2 && files.foto2[0]) {
        const file = files.foto2[0];
        const destinationPath = `${path}/${uuidv4()}_${file.originalname}`;
        foto2Url = await uploadFile(file.buffer, destinationPath, file.mimetype);
    }
    // --- FIN DE LA MODIFICACIÓN ---

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
        nota: parseFloat(nota),
        foto1Url,
        foto2Url,
        visibleEnWeb: false,
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
    // ... (Esta función no cambia y sigue siendo correcta)
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

    // --- INICIO DE LA MODIFICACIÓN (Lógica de borrado) ---
    // Usar la función correcta de tu servicio
    if (data.foto1Url) {
        await deleteFileByUrl(data.foto1Url).catch(e => console.error("Error al borrar foto1:", e.message));
    }
    if (data.foto2Url) {
        await deleteFileByUrl(data.foto2Url).catch(e => console.error("Error al borrar foto2:", e.message));
    }
    // --- FIN DE LA MODIFICACIÓN ---

    // Eliminar documento de Firestore
    await comentarioRef.delete();
};


module.exports = {
    buscarReservaParaComentario,
    crearComentario,
    obtenerComentarios,
    eliminarComentario
};