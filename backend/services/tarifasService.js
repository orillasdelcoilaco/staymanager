const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

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

    // Ahora solo guardamos el precio base. El resto se calculará dinámicamente.
    const preciosCalculados = {
        [canalPorDefectoId]: precioBase
    };

    const datosParaGuardar = {
        alojamientoId: datosTarifa.alojamientoId,
        temporada: datosTarifa.temporada,
        fechaInicio: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaInicio + 'T00:00:00Z')),
        fechaTermino: admin.firestore.Timestamp.fromDate(new Date(datosTarifa.fechaTermino + 'T00:00:00Z')),
        precios: preciosCalculados, // Guardamos solo el precio base
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
    // La función calcularYGuardarPrecios ahora solo guarda el precio base.
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
    const canales = canalesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const canalPorDefecto = canales.find(c => c.esCanalPorDefecto);

    if (!canalPorDefecto) {
        throw new Error("No se ha configurado un canal por defecto. Por favor, marque uno en 'Gestionar Canales'.");
    }

    const tarifasPromises = tarifasSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const fechaInicioDate = data.fechaInicio.toDate();
        const fechaInicio = fechaInicioDate.toISOString().split('T')[0];
        const fechaTermino = data.fechaTermino.toDate().toISOString().split('T')[0];
        
        const valorDolarDia = await obtenerValorDolar(db, empresaId, fechaInicioDate);
        const precioBase = (data.precios && data.precios[canalPorDefecto.id]) ? data.precios[canalPorDefecto.id] : 0;

        const preciosFinales = {};
        for (const canal of canales) {
            let precioConvertido = precioBase;

            // 1. Convertir moneda ANTES de aplicar modificador
            if (canal.moneda === 'USD' && canalPorDefecto.moneda === 'CLP' && valorDolarDia > 0) {
                precioConvertido = precioBase / valorDolarDia;
            } else if (canal.moneda === 'CLP' && canalPorDefecto.moneda === 'USD' && valorDolarDia > 0) {
                precioConvertido = precioBase * valorDolarDia;
            }

            let valorFinal = precioConvertido;

            // 2. Aplicar modificador sobre el valor ya convertido
            if (canal.id !== canalPorDefecto.id && canal.modificadorValor) {
                if (canal.modificadorTipo === 'porcentaje') {
                    valorFinal *= (1 + canal.modificadorValor / 100);
                } else if (canal.modificadorTipo === 'fijo') {
                    valorFinal += canal.modificadorValor;
                }
            }

            // 3. Guardar resultados para el frontend
            if (canal.moneda === 'USD') {
                preciosFinales[canal.id] = {
                    valorUSD: valorFinal,
                    valorCLP: valorFinal * valorDolarDia,
                    moneda: 'USD'
                };
            } else {
                 preciosFinales[canal.id] = {
                    valorCLP: valorFinal,
                    moneda: 'CLP'
                };
            }
        }

        return {
            id: doc.id,
            alojamientoId: data.alojamientoId,
            alojamientoNombre: propiedadesMap.get(data.alojamientoId) || 'Alojamiento no encontrado',
            temporada: data.temporada,
            precios: preciosFinales,
            fechaInicio,
            fechaTermino,
            valorDolarDia
        };
    });

    return Promise.all(tarifasPromises);
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