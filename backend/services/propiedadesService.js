// backend/services/propiedadesService.js
const admin = require('firebase-admin');

const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre || !datosPropiedad.capacidad) {
        throw new Error('El ID de la empresa, el nombre y la capacidad de la propiedad son requeridos.');
    }

    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc();

    const componentes = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];

    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: datosPropiedad.capacidad,
        descripcion: datosPropiedad.descripcion || '',
        numPiezas: datosPropiedad.numPiezas || 0,
        numBanos: datosPropiedad.numBanos || 0,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        componentes: componentes,
        googleHotelData: datosPropiedad.googleHotelData || {},
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {} }, // Asegurar que exista
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

const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const doc = await propiedadRef.get();

    if (!doc.exists) {
        return null;
    }

    return { id: doc.id, ...doc.data() };
};

// *** CORRECCIÓN P1 (Asegurar Merge) ***
const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    // Asegurarse de que componentes sea un array si se está actualizando
    if (datosActualizados.componentes && !Array.isArray(datosActualizados.componentes)) {
        datosActualizados.componentes = [];
    }
    
    // Eliminar linkFotos si viene (limpieza)
    delete datosActualizados.linkFotos;

    // Usar set con merge: true para actualizar campos anidados (como 'websiteData.aiDescription')
    // sin sobrescribir el objeto 'websiteData' completo.
    await propiedadRef.set(datosActualizados, { merge: true }); 

    // Actualizar fecha y eliminar campo antiguo
    await propiedadRef.update({
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
        linkFotos: admin.firestore.FieldValue.delete()
    });

    const docActualizado = await propiedadRef.get();
    return { id: propiedadId, ...docActualizado.data() };
};

const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    // TODO: Eliminar imágenes de Storage asociadas a esta propiedad
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    await propiedadRef.delete();
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad
};