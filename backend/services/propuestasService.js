// backend/services/propuestasService.js
const { obtenerPropiedadPorId } = require('./propiedadesService');

// Función auxiliar para obtener la imagen principal de una propiedad
function obtenerImagenPrincipal(propiedad) {
    if (propiedad.websiteData && propiedad.websiteData.images) {
        const imagenes = propiedad.websiteData.images;
        // Priorizar categorías específicas
        const portada = imagenes['portadaRecinto']?.[0] || imagenes['exteriorAlojamiento']?.[0];
        if (portada) return portada.storagePath;

        // Fallback: tomar la primera imagen de cualquier componente
        const allImages = Object.values(imagenes).flat();
        if (allImages.length > 0) return allImages[0].storagePath;
    }
    // Si no hay nada, placeholder
    return 'https://via.placeholder.com/400x300.png?text=Imagen+no+disponible';
}

const crearPropuesta = async (db, empresaId, datosPropuesta) => {
    const { clienteId, clienteNombre, fechaLlegada, fechaSalida, noches, adultos, ninos, propiedadesIds, notaAdicional } = datosPropuesta;

    if (!clienteId || !fechaLlegada || !fechaSalida || !propiedadesIds || propiedadesIds.length === 0) {
        throw new Error('Datos incompletos para crear la propuesta.');
    }

    let alojamientos = [];

    for (const propId of propiedadesIds) {
        const propiedad = await obtenerPropiedadPorId(db, empresaId, propId);
        if (propiedad) {
            
            // *** INICIO DE LA CORRECCIÓN ***
            const imagenUrl = obtenerImagenPrincipal(propiedad);
            // *** FIN DE LA CORRECCIÓN ***

            alojamientos.push({
                id: propiedad.id,
                nombre: propiedad.nombre,
                capacidad: propiedad.capacidad,
                // linkFotos: propiedad.linkFotos, // Campo antiguo eliminado
                linkFotos: imagenUrl, // Usar la nueva URL
                descripcion: propiedad.descripcion
                // En el futuro: podríamos añadir precios aquí
            });
        }
    }

    if (alojamientos.length === 0) {
        throw new Error('Ninguna de las propiedades seleccionadas pudo ser encontrada.');
    }

    const propuestaRef = db.collection('empresas').doc(empresaId).collection('propuestas').doc();
    const nuevaPropuesta = {
        id: propuestaRef.id,
        clienteId,
        clienteNombre,
        fechaCreacion: new Date(),
        fechaLlegada,
        fechaSalida,
        noches,
        adultos,
        ninos,
        alojamientos: alojamientos, // Array de objetos de alojamiento
        notaAdicional: notaAdicional || '',
        estado: 'pendiente' // 'pendiente', 'enviada', 'aceptada', 'rechazada'
    };

    await propuestaRef.set(nuevaPropuesta);
    return nuevaPropuesta;
};

const obtenerPropuestas = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('propuestas')
        .orderBy('fechaCreacion', 'desc')
        .get();

    if (snapshot.empty) {
        return [];
    }
    return snapshot.docs.map(doc => doc.data());
};

const obtenerPropuestaPorId = async (db, empresaId, propuestaId) => {
    const doc = await db.collection('empresas').doc(empresaId).collection('propuestas').doc(propuestaId).get();
    if (!doc.exists) {
        throw new Error('Propuesta no encontrada.');
    }
    return doc.data();
};

const actualizarEstadoPropuesta = async (db, empresaId, propuestaId, estado) => {
    const ref = db.collection('empresas').doc(empresaId).collection('propuestas').doc(propuestaId);
    await ref.update({ estado: estado });
    return { id: propuestaId, estado: estado };
};

module.exports = {
    crearPropuesta,
    obtenerPropuestas,
    obtenerPropuestaPorId,
    actualizarEstadoPropuesta
};