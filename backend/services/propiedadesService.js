// backend/services/propiedadesService.js
const admin = require('firebase-admin');
const { calcularCapacidad, contarDistribucion, hydrateInventory } = require('./propiedadLogicService');

const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre || !datosPropiedad.capacidad) {
        throw new Error('El ID de la empresa, el nombre y la capacidad de la propiedad son requeridos.');
    }
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc();

    // Sanitize componentes to ensure elementos is always an array
    const componentesRaw = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];
    const componentes = componentesRaw.map(c => ({
        ...c,
        elementos: Array.isArray(c.elementos) ? c.elementos : []
    }));

    // Calcular campos derivados automáticamente
    const { numPiezas, numBanos } = contarDistribucion(componentes);
    const capacidadCalculada = calcularCapacidad(componentes);

    // Prioridad: 1. Valor manual explícito, 2. Valor calculado
    const capacidadFinal = datosPropiedad.capacidad || capacidadCalculada;

    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: capacidadFinal,
        calculated_capacity: capacidadCalculada,
        descripcion: datosPropiedad.descripcion || '',
        numPiezas: numPiezas,
        numBanos: numBanos,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        componentes: componentes,
        googleHotelData: datosPropiedad.googleHotelData || {},
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null },
        amenidades: datosPropiedad.amenidades || [],
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await propiedadRef.set(nuevaPropiedad);

    // [AI-CONTEXT] Hidratar respuesta para uso inmediato
    const aiContext = hydrateInventory(componentes);

    return { id: propiedadRef.id, ...nuevaPropiedad, ai_context: aiContext };
};

const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa - empresaId es INVÁLIDO. No se puede continuar.`);
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido: '${empresaId}'`);
    }

    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();

    if (propiedadesSnapshot.empty) {
        return [];
    }

    return propiedadesSnapshot.docs.map(doc => {
        const data = doc.data();
        // [AI-CONTEXT] Hidratar inventario on-the-fly
        const aiContext = hydrateInventory(data.componentes || []);
        return {
            id: doc.id,
            ...data,
            ai_context: aiContext
        };
    });
};

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

    const data = doc.data();
    // [AI-CONTEXT] Hidratar inventario on-the-fly
    const aiContext = hydrateInventory(data.componentes || []);

    return { id: doc.id, ...data, ai_context: aiContext };
};

const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    // Si se actualizan componentes, recalcular derivados
    if (datosActualizados.componentes) {
        const componentesRaw = Array.isArray(datosActualizados.componentes) ? datosActualizados.componentes : [];
        const componentes = componentesRaw.map(c => ({
            ...c,
            elementos: Array.isArray(c.elementos) ? c.elementos : []
        }));
        datosActualizados.componentes = componentes;

        // Recalcular
        const { numPiezas, numBanos } = contarDistribucion(componentes);
        const capacidadCalculada = calcularCapacidad(componentes);

        datosActualizados.numPiezas = numPiezas;
        datosActualizados.numBanos = numBanos;
        datosActualizados.calculated_capacity = capacidadCalculada;

        // Solo actualizar capacidad principal si no viene explícita en el update
        if (!datosActualizados.capacidad) {
            datosActualizados.capacidad = capacidadCalculada;
        }
    }

    if (datosActualizados.amenidades && !Array.isArray(datosActualizados.amenidades)) {
        datosActualizados.amenidades = [];
    }

    await propiedadRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    const docActualizado = await propiedadRef.get();
    const data = docActualizado.data();

    // [AI-CONTEXT] Hidratar respuesta
    const aiContext = hydrateInventory(data.componentes || []);

    return { id: propiedadId, ...data, ai_context: aiContext };
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