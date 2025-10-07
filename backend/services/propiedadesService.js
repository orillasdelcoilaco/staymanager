// backend/services/propiedadesService.js
const admin = require('firebase-admin');

const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre || !datosPropiedad.capacidad) {
        throw new Error('El ID de la empresa, el nombre y la capacidad de la propiedad son requeridos.');
    }

    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc();
    
    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: datosPropiedad.capacidad,
        descripcion: datosPropiedad.descripcion || '',
        linkFotos: datosPropiedad.linkFotos || '',
        numPiezas: datosPropiedad.numPiezas || 0,
        numBanos: datosPropiedad.numBanos || 0,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {}, // Añadido
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await propiedadRef.set(nuevaPropiedad);

    return { id: propiedadRef.id, ...nuevaPropiedad };
};

const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();
    
    if (propiedadesSnapshot.empty) {
        return [];
    }

    return propiedadesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    
    // Asegurarse de que el campo de sincronización iCal se actualice correctamente
    const datosParaActualizar = { ...datosActualizados };
    if (datosParaActualizar.sincronizacionIcal) {
        datosParaActualizar.sincronizacionIcal = datosParaActualizar.sincronizacionIcal;
    }

    await propiedadRef.set(datosParaActualizar, { merge: true });
    await propiedadRef.update({
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    return { id: propiedadId, ...datosActualizados };
};

const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    await propiedadRef.delete();
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    actualizarPropiedad,
    eliminarPropiedad
};