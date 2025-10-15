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

module.exports = {
    crearCampanaYRegistrarInteracciones
};