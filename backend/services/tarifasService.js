const admin = require('firebase-admin');

const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!empresaId || !datosTarifa.alojamientoId || !datosTarifa.temporada || !datosTarifa.fechaInicio || !datosTarifa.fechaTermino || !datosTarifa.precioBase) {
        throw new Error('Faltan datos requeridos para crear la tarifa.');
    }

    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalDefectoSnapshot.empty) {
        throw new Error('No se ha configurado un canal por defecto. Por favor, marque uno en "Gestionar Canales".');
    }
    const canalPorDefectoId = canalDefectoSnapshot.docs[0].id;

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    
    const nuevaTarifa = {
        alojamientoId: datosTarifa.alojamientoId,
        temporada: datosTarifa.temporada,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaTermino + 'T00:00:00Z')),
        precios: {
            [canalPorDefectoId]: parseFloat(datosTarifa.precioBase)
        },
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await tarifaRef.set(nuevaTarifa);
    return { id: tarifaRef.id, ...nuevaTarifa };
};

const obtenerTarifasPorEmpresa = async (db, empresaId) => {
    const [tarifasSnapshot, propiedadesSnapshot, canalesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('tarifas').orderBy('fechaInicio', 'desc').get(),
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('canales').get()
    ]);
    
    if (tarifasSnapshot.empty) {
        return [];
    }

    const propiedadesMap = new Map(propiedadesSnapshot.docs.map(doc => [doc.id, doc.data().nombre]));
    const canalesMap = new Map(canalesSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const canalPorDefecto = canalesSnapshot.docs.find(doc => doc.data().esCanalPorDefecto);

    if (!canalPorDefecto) {
        return [];
    }
    const canalPorDefectoId = canalPorDefecto.id;

    return tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        const fechaInicio = data.fechaInicio && typeof data.fechaInicio.toDate === 'function' 
            ? data.fechaInicio.toDate().toISOString().split('T')[0] 
            : data.fechaInicio;
        const fechaTermino = data.fechaTermino && typeof data.fechaTermino.toDate === 'function' 
            ? data.fechaTermino.toDate().toISOString().split('T')[0] 
            : data.fechaTermino;
        
        const preciosFinales = {};
        const precioBase = data.precios && data.precios[canalPorDefectoId] ? data.precios[canalPorDefectoId] : 0;

        for (const canal of canalesMap.values()) {
            let valorFinal = precioBase;
            if (canal.id !== canalPorDefectoId && canal.modificadorValor) {
                if (canal.modificadorTipo === 'porcentaje') {
                    valorFinal *= (1 + (canal.modificadorValor / 100));
                } else if (canal.modificadorTipo === 'fijo') {
                    valorFinal += canal.modificadorValor;
                }
            }
            preciosFinales[canal.id] = { valor: valorFinal, moneda: canal.moneda };
        }

        return {
            id: doc.id,
            alojamientoId: data.alojamientoId,
            alojamientoNombre: propiedadesMap.get(data.alojamientoId) || 'Alojamiento no encontrado',
            temporada: data.temporada,
            precios: preciosFinales,
            fechaInicio,
            fechaTermino
        };
    });
};

const actualizarTarifa = async (db, empresaId, tarifaId, datosActualizados) => {
    console.log('[DEBUG Service] 1. Iniciando actualizarTarifa. Datos recibidos:', datosActualizados);

    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalDefectoSnapshot.empty) {
        throw new Error('No se ha configurado un canal por defecto.');
    }
    const canalPorDefectoId = canalDefectoSnapshot.docs[0].id;
    console.log(`[DEBUG Service] 2. ID del canal por defecto encontrado: ${canalPorDefectoId}`);

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    console.log(`[DEBUG Service] 3. Obteniendo documento de tarifa existente con ID: ${tarifaId}`);
    const tarifaDoc = await tarifaRef.get();
    if (!tarifaDoc.exists) {
        throw new Error('La tarifa que intentas actualizar no existe.');
    }
    console.log('[DEBUG Service] 4. Documento existente encontrado:', tarifaDoc.data());

    const preciosActuales = tarifaDoc.data().precios || {};
    console.log('[DEBUG Service] 5. Objeto de precios antes de la modificación:', preciosActuales);
    
    preciosActuales[canalPorDefectoId] = parseFloat(datosActualizados.precioBase);
    console.log('[DEBUG Service] 6. Objeto de precios DESPUÉS de la modificación:', preciosActuales);

    const datosParaActualizar = {
        temporada: datosActualizados.temporada,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaTermino + 'T00:00:00Z')),
        precios: preciosActuales,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };
    console.log('[DEBUG Service] 7. Objeto final que se enviará a Firestore:', datosParaActualizar);

    await tarifaRef.update(datosParaActualizar);
    console.log('[DEBUG Service] 8. ¡Update en Firestore completado con éxito!');

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