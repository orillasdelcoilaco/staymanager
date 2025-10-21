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
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {} },
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

const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    if (datosActualizados.componentes && !Array.isArray(datosActualizados.componentes)) {
        datosActualizados.componentes = [];
    }
    
    delete datosActualizados.linkFotos;

    // *** INICIO DE LA CORRECCIÓN P2 ***
    // Usar 'update' para fusionar campos anidados (como 'websiteData.aiDescription')
    // sin sobrescribir 'websiteData.images'.
    await propiedadRef.update({
        ...datosActualizados, // Esto aplicará 'websiteData.aiDescription': '...' o 'googleHotelData.isListed': true
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
        linkFotos: admin.firestore.FieldValue.delete()
    });
    // *** FIN DE LA CORRECCIÓN P2 ***

    const docActualizado = await propiedadRef.get();
    return { id: propiedadId, ...docActualizado.data() };
};

const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    // TODO: Implementar borrado de imágenes en Storage asociadas a esta propiedad
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