// backend/services/campanasService.js
const admin = require('firebase-admin');

const crearCampanaYRegistrarInteracciones = async (db, empresaId, datosCampana) => {
    const { nombre, segmento, mensaje, clientes, autor } = datosCampana;

    if (!nombre || !segmento || !mensaje || !clientes || !autor) {
        throw new Error('Faltan datos para crear la campaña.');
    }

    // 1. Crear el documento de la campaña
    const campanasRef = db.collection('empresas').doc(empresaId).collection('campanas');
    const campanaDocRef = campanasRef.doc();
    
    const nuevaCampana = {
        id: campanaDocRef.id,
        nombre,
        segmento,
        mensaje,
        autor,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        totalEnviados: clientes.length,
        estados: {
            Enviado: clientes.length,
            Respondio: 0,
            NoInteresado: 0,
            Reservo: 0,
            SinRespuesta: 0
        }
    };
    
    // 2. Crear un batch para las interacciones
    const batch = db.batch();
    batch.set(campanaDocRef, nuevaCampana);

    const interaccionesRef = db.collection('empresas').doc(empresaId).collection('interacciones');
    clientes.forEach(cliente => {
        const interaccionDocRef = interaccionesRef.doc();
        const nuevaInteraccion = {
            id: interaccionDocRef.id,
            campanaId: campanaDocRef.id,
            clienteId: cliente.id,
            clienteNombre: cliente.nombre,
            estado: 'Enviado',
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            fechaUltimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(interaccionDocRef, nuevaInteraccion);
    });

    // 3. Ejecutar la transacción
    await batch.commit();

    return nuevaCampana;
};

const actualizarEstadoInteraccion = async (db, empresaId, interaccionId, nuevoEstado) => {
    const interaccionRef = db.collection('empresas').doc(empresaId).collection('interacciones').doc(interaccionId);

    return db.runTransaction(async (transaction) => {
        const interaccionDoc = await transaction.get(interaccionRef);
        if (!interaccionDoc.exists) {
            throw new Error('La interacción no fue encontrada.');
        }

        const interaccionData = interaccionDoc.data();
        const estadoAntiguo = interaccionData.estado;

        if (estadoAntiguo === nuevoEstado) {
            return; // No hay cambios que hacer
        }

        const campanaRef = db.collection('empresas').doc(empresaId).collection('campanas').doc(interaccionData.campanaId);
        const campanaDoc = await transaction.get(campanaRef);
        if (!campanaDoc.exists) {
            throw new Error('La campaña asociada no fue encontrada.');
        }

        // Actualizar la interacción
        transaction.update(interaccionRef, {
            estado: nuevoEstado,
            fechaUltimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        });

        // Actualizar los contadores de la campaña
        const campanaData = campanaDoc.data();
        const nuevosEstados = { ...campanaData.estados };
        nuevosEstados[estadoAntiguo] = (nuevosEstados[estadoAntiguo] || 0) - 1;
        nuevosEstados[nuevoEstado] = (nuevosEstados[nuevoEstado] || 0) + 1;

        transaction.update(campanaRef, { estados: nuevosEstados });
    });
};

const obtenerCampanas = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('campanas')
        .orderBy('fechaCreacion', 'desc')
        .get();
    
    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data());
};


module.exports = {
    crearCampanaYRegistrarInteracciones,
    actualizarEstadoInteraccion,
    obtenerCampanas
};