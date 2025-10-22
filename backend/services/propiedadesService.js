// backend/services/propiedadesService.js
const admin = require('firebase-admin');

// ... (crearPropiedad sin cambios) ...
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
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null },
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await propiedadRef.set(nuevaPropiedad);
    return { id: propiedadRef.id, ...nuevaPropiedad };
};


const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    // *** INICIO DEPURACIÓN ***
    console.log(`[DEBUG] obtenerPropiedadesPorEmpresa - Intentando obtener doc para empresaId: '${empresaId}' (Tipo: ${typeof empresaId})`);
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa - empresaId es INVÁLIDO. No se puede continuar.`);
        // Lanzar un error aquí podría ser más claro que dejar que Firestore falle
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido: '${empresaId}'`);
        // O simplemente retornar un array vacío si prefieres no crashear
        // return [];
    }
    // *** FIN DEPURACIÓN ***

    // La línea original que causa el error según el log (ahora línea ~41)
    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();

    if (propiedadesSnapshot.empty) {
        return [];
    }

    return propiedadesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

// ... (obtenerPropiedadPorId, actualizarPropiedad, eliminarPropiedad sin cambios) ...
const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') {
        console.error(`[propiedadesService] Error: Se llamó a obtenerPropiedadPorId con un ID inválido: '${propiedadId}'`);
        return null;
    }
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
    await propiedadRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    const docActualizado = await propiedadRef.get();
    return { id: propiedadId, ...docActualizado.data() };
};
const eliminarPropiedad = async (db, empresaId, propiedadId) => {
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