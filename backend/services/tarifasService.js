const admin = require('firebase-admin');

const calcularYGuardarPrecios = async (db, empresaId, datosTarifa, tarifaRef, transaction = null) => {
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, todosLosCanalesSnapshot] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.get()
    ]);

    if (canalDefectoSnapshot.empty) {
        throw new Error('No se ha configurado un canal por defecto.');
    }
    const canalPorDefectoId = canalDefectoSnapshot.docs[0].id;
    const precioBase = parseFloat(datosTarifa.precioBase);
    if (isNaN(precioBase)) {
        throw new Error('El valor de precioBase no es válido.');
    }

    const preciosCalculados = {};
    todosLosCanalesSnapshot.forEach(doc => {
        const canal = doc.data();
        const idCanal = doc.id;
        let valorFinal = precioBase;

        if (idCanal !== canalPorDefectoId && canal.modificadorValor) {
            if (canal.modificadorTipo === 'porcentaje') {
                valorFinal *= (1 + canal.modificadorValor / 100);
            } else if (canal.modificadorTipo === 'fijo') {
                valorFinal += canal.modificadorValor;
            }
        }
        preciosCalculados[idCanal] = valorFinal;
    });

    const datosParaGuardar = {
        alojamientoId: datosTarifa.alojamientoId,
        temporada: datosTarifa.temporada,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaTermino + 'T00:00:00Z')),
        precios: preciosCalculados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
        transaction.update(tarifaRef, datosParaGuardar);
    } else {
        await tarifaRef.set({ ...datosParaGuardar, fechaCreacion: admin.firestore.FieldValue.serverTimestamp() });
    }

    return datosParaGuardar;
};


const crearTarifa = async (db, empresaId, datosTarifa) => {
    if (!datosTarifa.alojamientoId || !datosTarifa.precioBase) {
        throw new Error('Faltan datos requeridos para crear la tarifa.');
    }
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc();
    const nuevaTarifa = await calcularYGuardarPrecios(db, empresaId, datosTarifa, tarifaRef);
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
    
    return tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        const fechaInicio = data.fechaInicio.toDate().toISOString().split('T')[0];
        const fechaTermino = data.fechaTermino.toDate().toISOString().split('T')[0];
        
        const preciosFinales = {};
        for (const [canalId, canal] of canalesMap.entries()) {
            preciosFinales[canalId] = {
                valor: data.precios[canalId] || 0,
                moneda: canal.moneda
            };
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
    const tarifaRef = db.collection('empresas').doc(empresaId).collection('tarifas').doc(tarifaId);
    
    await db.runTransaction(async (transaction) => {
        const tarifaDoc = await transaction.get(tarifaRef);
        if (!tarifaDoc.exists) {
            throw new Error("La tarifa que intentas actualizar no existe.");
        }
        
        // Mantener el alojamientoId original, ya que no se puede cambiar.
        const datosCompletos = { ...datosActualizados, alojamientoId: tarifaDoc.data().alojamientoId };
        
        await calcularYGuardarPrecios(db, empresaId, datosCompletos, tarifaRef, transaction);
    });

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