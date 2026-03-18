// backend/services/propiedadesService.js
const admin = require('firebase-admin');
const { calcularCapacidad, contarDistribucion, hydrateInventory } = require('./propiedadLogicService');

const slugify = (text) => {
    return text.toString().toLowerCase()
        .normalize('NFD') // Normaliza caracteres con acentos
        .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
        .replace(/\s+/g, '') // Elimina espacios (Usuario pidió "casa1" para "Propiedad 1", sin guiones si es posible, o pegado)
        // El usuario dijo "cabaña 1 deberia ser casa1". 
        // Vamos a usar un slug más estándar: "cabana-1".
        // Si prefiere sin guiones: .replace(/\s+/g, '')
        // Voy a usar standard slug con guiones para legibilidad y SEO, pero removiendo chars especiales.
        .replace(/[^a-z0-9]/g, '') // Solo alfanumérico (casa1 style)
};

const generarIdComponente = (nombre) => {
    const slug = slugify(nombre || 'componente');
    return `${slug}-${Date.now()}`;
};

const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    // Se permite capacidad 0 (o nula) para guardar borradores, aunque se recomienda tener capacidad.
    if (!empresaId || !datosPropiedad.nombre) {
        throw new Error('El ID de la empresa y el nombre de la propiedad son requeridos.');
    }

    // Generar ID legible
    let baseId = slugify(datosPropiedad.nombre);
    if (!baseId) baseId = 'propiedad-' + Date.now();

    let docId = baseId;
    let counter = 1;
    let propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);

    // Verificar colisión (simple check)
    let doc = await propiedadRef.get();
    while (doc.exists) {
        docId = `${baseId}-${counter}`;
        propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);
        doc = await propiedadRef.get();
        counter++;
    }

    // Sanitize componentes to ensure elementos is always an array
    const componentesRaw = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];
    const componentes = componentesRaw.map(c => ({
        ...c,
        elementos: Array.isArray(c.elementos) ? c.elementos : []
    }));

    // Calcular campos derivados automáticamente
    const { numPiezas: piezasCalculadas, numBanos: banosCalculados } = contarDistribucion(componentes);
    const capacidadCalculada = calcularCapacidad(componentes);

    // Prioridad: 1. Valor manual/importado, 2. Valor calculado desde componentes
    const capacidadFinal = datosPropiedad.capacidad || datosPropiedad.capacidadMaxima || capacidadCalculada;
    console.log(`[PropSvc] 💾 "${datosPropiedad.nombre}": capacidad=${capacidadFinal} (manual=${datosPropiedad.capacidad || datosPropiedad.capacidadMaxima}, calc=${capacidadCalculada}) | piezas=${datosPropiedad.numDormitorios || datosPropiedad.numPiezas || piezasCalculadas} | baños=${datosPropiedad.numBanos || banosCalculados}`);

    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: capacidadFinal,
        calculated_capacity: capacidadCalculada,
        descripcion: datosPropiedad.descripcion || '',
        numPiezas: datosPropiedad.numDormitorios || datosPropiedad.numPiezas || piezasCalculadas,
        numBanos: datosPropiedad.numBanos || banosCalculados,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        // LEGACY: Mantener arrays por compatibilidad temporal
        componentes: componentes,
        amenidades: datosPropiedad.amenidades || [],

        googleHotelData: datosPropiedad.googleHotelData || {},
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null },
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    // 1. Guardar documento principal
    await propiedadRef.set(nuevaPropiedad);

    // 2. Guardar en Subcolecciones (Nuevo Modelo)
    const batch = db.batch();

    // Componentes
    componentes.forEach(comp => {
        const compRef = propiedadRef.collection('componentes').doc();
        batch.set(compRef, comp);
    });

    // Amenidades
    const amenidades = datosPropiedad.amenidades || [];
    amenidades.forEach(amenidad => {
        const amRef = propiedadRef.collection('amenidades').doc();
        batch.set(amRef, amenidad);
    });

    await batch.commit();

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
            ...data, // Spread data FIRST
            id: doc.id, // Ensure Doc ID overwrites any internal 'id'
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

    return { ...data, id: doc.id, ai_context: aiContext };
};

const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    // Si se actualizan componentes, recalcular derivados y sincronizar subcolección
    if (datosActualizados.componentes) {
        const componentesRaw = Array.isArray(datosActualizados.componentes) ? datosActualizados.componentes : [];
        const componentes = componentesRaw.map(c => ({
            ...c,
            id: c.id || generarIdComponente(c.nombre),
            elementos: Array.isArray(c.elementos) ? c.elementos : []
        }));
        datosActualizados.componentes = componentes; // LEGACY

        // Recalcular
        const { numPiezas, numBanos } = contarDistribucion(componentes);
        const capacidadCalculada = calcularCapacidad(componentes);

        datosActualizados.numPiezas = numPiezas;
        datosActualizados.numBanos = numBanos;
        datosActualizados.calculated_capacity = capacidadCalculada;

        if (!datosActualizados.capacidad) {
            datosActualizados.capacidad = capacidadCalculada;
        }

        // Sincronizar Subcolección Componentes (Estrategia: Eliminar y Recrear para garantizar consistencia)
        const batch = db.batch();
        const existingComps = await propiedadRef.collection('componentes').get();
        existingComps.forEach(doc => batch.delete(doc.ref));

        componentes.forEach(comp => {
            const newDoc = propiedadRef.collection('componentes').doc();
            batch.set(newDoc, comp);
        });
        await batch.commit();
    }

    if (datosActualizados.amenidades) {
        if (!Array.isArray(datosActualizados.amenidades)) {
            datosActualizados.amenidades = [];
        }
        // Sincronizar Subcolección Amenidades
        const batch = db.batch();
        const existingAmens = await propiedadRef.collection('amenidades').get();
        existingAmens.forEach(doc => batch.delete(doc.ref));

        datosActualizados.amenidades.forEach(am => {
            const newDoc = propiedadRef.collection('amenidades').doc();
            batch.set(newDoc, am);
        });
        await batch.commit();
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
    // 1. Verificar Reservas dependientes (Integridad Referencial)
    const reservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('alojamientoId', '==', propiedadId)
        .limit(1)
        .get();

    if (!reservasSnapshot.empty) {
        const resId = reservasSnapshot.docs[0].id;
        throw new Error(`No se puede eliminar: Tiene reservas asociadas (Ej: ${resId}).`);
    }

    // 2. Verificar Tarifas dependientes
    const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas')
        .where('alojamientoId', '==', propiedadId)
        .limit(1)
        .get();

    if (!tarifasSnapshot.empty) {
        const rateId = tarifasSnapshot.docs[0].id;
        throw new Error(`No se puede eliminar: Tiene tarifas configuradas (Ej: ${rateId}).`);
    }

    // 3. Si paso las verificaciones, proceder a eliminar
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    await propiedadRef.delete();
};

/**
 * Clona una propiedad existente incluyendo sus subcolecciones.
 */
const clonarPropiedad = async (db, empresaId, propiedadId, customName = null) => {
    const sourceRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const sourceDoc = await sourceRef.get();

    if (!sourceDoc.exists) {
        throw new Error('La propiedad original no existe.');
    }

    const sourceData = sourceDoc.data();

    // CRITICAL: Remove 'id' from source data to prevent overwriting the new document's ID
    if (sourceData.id) delete sourceData.id;

    const nuevoNombre = customName || `${sourceData.nombre} (Copia)`;

    // Generar nuevo ID
    let baseId = slugify(nuevoNombre);
    if (!baseId) baseId = 'propiedad-copia-' + Date.now();

    let docId = baseId;
    let counter = 1;
    let targetRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);
    let targetDoc = await targetRef.get();

    while (targetDoc.exists) {
        docId = `${baseId}-${counter}`;
        targetRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);
        targetDoc = await targetRef.get();
        counter++;
    }

    // Preparar objeto
    // Preparar objeto
    const nuevaPropiedad = {
        ...sourceData,
        nombre: nuevoNombre,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        googleHotelData: {
            ...sourceData.googleHotelData,
            hotelId: baseId, // Auto-generate clean ID for Google Hotels
            isListed: false
        },
        icalLink: '',
        sincronizacionIcal: {}
    };

    const batch = db.batch();

    // 1. Set main doc
    batch.set(targetRef, nuevaPropiedad);

    // 2. Clone Subcollections (Componentes)
    const componentesSnap = await sourceRef.collection('componentes').get();

    if (!componentesSnap.empty) {
        // Source has subcollection -> Copy it
        componentesSnap.forEach(doc => {
            const newCompRef = targetRef.collection('componentes').doc(); // Auto-ID
            batch.set(newCompRef, doc.data());
        });
    } else if (sourceData.componentes && Array.isArray(sourceData.componentes)) {
        // FALLBACK: Source only has Legacy Array -> Create subcollection from it
        sourceData.componentes.forEach(comp => {
            const newCompRef = targetRef.collection('componentes').doc();
            batch.set(newCompRef, comp);
        });
    }

    // 3. Clone Subcollections (Amenidades)
    const amenidadesSnap = await sourceRef.collection('amenidades').get();

    if (!amenidadesSnap.empty) {
        amenidadesSnap.forEach(doc => {
            const newAmRef = targetRef.collection('amenidades').doc();
            batch.set(newAmRef, doc.data());
        });
    } else if (sourceData.amenidades && Array.isArray(sourceData.amenidades)) {
        // FALLBACK: Legacy Array
        sourceData.amenidades.forEach(am => {
            const newAmRef = targetRef.collection('amenidades').doc();
            batch.set(newAmRef, am);
        });
    }

    await batch.commit();

    // Context for immediate return
    const aiContext = hydrateInventory(nuevaPropiedad.componentes || []);

    return { id: targetRef.id, ...nuevaPropiedad, ai_context: aiContext };
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad,
    clonarPropiedad
};