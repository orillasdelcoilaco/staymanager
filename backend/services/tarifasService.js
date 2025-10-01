const admin = require('firebase-admin');

const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!empresaId || !datosTarifa.alojamientoId || !datosTarifa.temporada || !datosTarifa.fechaInicio || !datosTarifa.fechaTermino) {
        throw new Error('Faltan datos requeridos para crear la tarifa.');
    }

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    
    const nuevaTarifa = {
        ...datosTarifa,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaTermino + 'T00:00:00Z')),
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await tarifaRef.set(nuevaTarifa);
    return { id: tarifaRef.id, ...nuevaTarifa };
};

const obtenerTarifasPorEmpresa = async (db, empresaId) => {
    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas')
        .orderBy('alojamientoNombre', 'asc')
        .orderBy('fechaInicio', 'desc')
        .get();
    
    if (tarifasSnapshot.empty) {
        return [];
    }

    return tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            fechaInicio: data.fechaInicio.toDate().toISOString().split('T')[0],
            fechaTermino: data.fechaTermino.toDate().toISOString().split('T')[0]
        };
    });
};

const actualizarTarifa = async (db, empresaId, tarifaId, datosActualizados) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    if (datosActualizados.fechaInicio) {
        datosActualizados.fechaInicio = admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaInicio + 'T00:00:00Z'));
    }
    if (datosActualizados.fechaTermino) {
        datosActualizados.fechaTermino = admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaTermino + 'T00:00:00Z'));
    }

    await tarifaRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: tarifaId, ...datosActualizados };
};

const eliminarTarifa = async (db, empresaId, tarifaId) => {
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    await tarifaRef.delete();
};

module.exports = {
    crearTarifa,
    obtenerTarifasPorEmpresa,
    actualizarTarifa,
    eliminarTarifa
};