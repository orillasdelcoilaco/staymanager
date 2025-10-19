// backend/services/propiedadesService.js
const admin = require('firebase-admin');

const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre || !datosPropiedad.capacidad) {
        throw new Error('El ID de la empresa, el nombre y la capacidad de la propiedad son requeridos.');
    }

    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc();

    // Asegurarse de que componentes sea un array, incluso si viene vacío o undefined
    const componentes = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];

    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: datosPropiedad.capacidad,
        descripcion: datosPropiedad.descripcion || '',
        linkFotos: datosPropiedad.linkFotos || '',
        numPiezas: datosPropiedad.numPiezas || 0,
        numBanos: datosPropiedad.numBanos || 0,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        componentes: componentes, // Añadido: Guardar lista de componentes
        googleHotelData: datosPropiedad.googleHotelData || {}, // Asegurarse que existe el objeto
        websiteData: datosPropiedad.websiteData || {}, // Añadir objeto para datos web
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
        return null; // Cambiado para devolver null si no se encuentra
    }

    return { id: doc.id, ...doc.data() };
};

const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    // Asegurarse de que componentes sea un array si se está actualizando
    if (datosActualizados.componentes && !Array.isArray(datosActualizados.componentes)) {
        datosActualizados.componentes = [];
    }

    // Asegurarse de que el campo de sincronización iCal se actualice correctamente
    const datosParaActualizar = { ...datosActualizados };
    if (datosParaActualizar.sincronizacionIcal) {
        datosParaActualizar.sincronizacionIcal = datosParaActualizar.sincronizacionIcal;
    }
    // Asegurarse que googleHotelData y websiteData existen si vienen datos para ellos
    if (datosParaActualizar.googleHotelData) {
         datosParaActualizar.googleHotelData = datosParaActualizar.googleHotelData;
    }
    if (datosParaActualizar.websiteData) {
         datosParaActualizar.websiteData = datosParaActualizar.websiteData;
    }


    await propiedadRef.set(datosParaActualizar, { merge: true }); // Usar set con merge para crear campos si no existen
    await propiedadRef.update({
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });

    // Devolver los datos actualizados fusionados con los existentes para tener el estado completo
    const docActualizado = await propiedadRef.get();
    return { id: propiedadId, ...docActualizado.data() };
};

const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    // Considerar eliminar datos asociados en Storage si es necesario en el futuro
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