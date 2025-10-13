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
        return []; // O manejar el error como prefieras
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
            if (canal.modificadorValor && canal.id !== canalPorDefectoId) {
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
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalDefectoSnapshot.empty) {
        throw new Error('No se ha configurado un canal por defecto.');
    }
    const canalPorDefectoId = canalDefectoSnapshot.docs[0].id;

    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    // --- INICIO DE LA CORRECCIÓN ---
    // Se utiliza un objeto plano y "dot notation" para actualizar el campo anidado,
    // lo cual es el método más robusto y recomendado por Firestore.
    const datosParaActualizar = {
        temporada: datosActualizados.temporada,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosActualizados.fechaTermino + 'T00:00:00Z')),
        [`precios.${canalPorDefectoId}`]: parseFloat(datosActualizados.precioBase),
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await tarifaRef.update(datosParaActualizar);
    // --- FIN DE LA CORRECCIÓN ---

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