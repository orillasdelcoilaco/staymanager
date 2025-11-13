// backend/services/analisisFinancieroService.js
const admin = require('firebase-admin');
// --- INICIO DE LA MODIFICACIÓN ---
const { obtenerValorDolar, obtenerValorDolarHoy } = require('./dolarService');
const { recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');
// --- FIN DE LA MODIFICACIÓN ---

const actualizarValoresGrupo = async (db, empresaId, valoresCabanas, nuevoTotalHuesped) => {
    const batch = db.batch();
    
    const docs = await Promise.all(valoresCabanas.map(item => 
        db.collection('empresas').doc(empresaId).collection('reservas').doc(item.id).get()
    ));

    if (docs.length === 0 || !docs[0].exists) {
        throw new Error("No se encontraron las reservas para actualizar.");
    }

    // --- INICIO DE LA LÓGICA DE RECÁLCULO (G-077) ---

    // 1. Obtener datos base de la primera reserva (asumimos que el grupo comparte moneda, canal, etc.)
    const primeraReserva = docs[0].data();
    const moneda = primeraReserva.moneda || 'CLP';
    const canalId = primeraReserva.canalId;
    const valoresExistentesGrupo = {
        valorHuesped: 0,
        valorHuespedCalculado: 0,
        comisionOriginal: 0
    };

    docs.forEach(doc => {
        const data = doc.data().valores || {};
        valoresExistentesGrupo.valorHuesped += data.valorHuesped || 0; // Total CLP actual
        valoresExistentesGrupo.valorHuespedCalculado += data.valorHuespedCalculado || 0; // Ancla USD
        valoresExistentesGrupo.comisionOriginal += data.comisionOriginal || 0; // Comisión Sumable USD
    });

    // 2. Determinar el valor del dólar a usar (Lógica Fijo/Flotante)
    let valorDolarUsado = 1;
    if (moneda !== 'CLP') {
        const fechaActual = new Date();
        fechaActual.setUTCHours(0, 0, 0, 0);
        const fechaLlegada = primeraReserva.fechaLlegada?.toDate ? primeraReserva.fechaLlegada.toDate() : null;
        const esFacturado = primeraReserva.estadoGestion === 'Facturado';
        const esPasado = fechaLlegada && fechaLlegada < fechaActual;
        const esFijo = esFacturado || esPasado;

        if (esFijo) {
            valorDolarUsado = primeraReserva.valores?.valorDolarFacturacion || (fechaLlegada ? await obtenerValorDolar(db, empresaId, fechaLlegada) : (await obtenerValorDolarHoy(db, empresaId)).valor);
        } else {
            valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
        }
    }

    // 3. Convertir el nuevo total (CLP) a la moneda original (USD)
    const nuevoTotalHuespedCLP = parseFloat(nuevoTotalHuesped);
    const nuevoTotalHuespedUSD = (moneda !== 'CLP' && valorDolarUsado > 0) 
        ? nuevoTotalHuespedCLP / valorDolarUsado 
        : nuevoTotalHuespedCLP;

    // 4. Obtener configuración del canal y recalcular valores base en USD
    const canal = await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).get();
    const configuracionIva = canal.exists ? (canal.data().configuracionIva || 'incluido') : 'incluido';
    
    const valoresRecalculadosGrupoUSD = recalcularValoresDesdeTotal(
        nuevoTotalHuespedUSD,
        configuracionIva,
        valoresExistentesGrupo.comisionOriginal // Usamos la comisión sumable total del grupo
    );

    // 5. Calcular el ajuste total contra el "Ancla"
    const anclaTotalGrupoUSD = valoresExistentesGrupo.valorHuespedCalculado;
    const ajusteManualUSD = nuevoTotalHuespedUSD - anclaTotalGrupoUSD;

    // 6. Distribuir los nuevos valores proporcionalmente
    const totalHuespedActualCLP = valoresExistentesGrupo.valorHuesped;
    if (totalHuespedActualCLP === 0) {
        // Evitar división por cero si el valor actual es 0 (ej. reserva iCal)
        // Distribuir equitativamente
        const proporcion = 1 / docs.length;

        docs.forEach(doc => {
            const reserva = doc.data();
            const nuevosValores = { ...reserva.valores };
            const nuevosAjustes = { ...reserva.ajustes };

            // Set "Actual" (USD)
            nuevosValores.valorHuespedOriginal = valoresRecalculadosGrupoUSD.valorHuespedOriginal * proporcion;
            nuevosValores.valorTotalOriginal = valoresRecalculadosGrupoUSD.valorTotalOriginal * proporcion;
            nuevosValores.ivaOriginal = valoresRecalculadosGrupoUSD.ivaOriginal * proporcion;
            
            // Set "Actual" (CLP)
            nuevosValores.valorHuesped = Math.round(nuevoTotalHuespedCLP * proporcion);
            nuevosValores.valorTotal = Math.round(valoresRecalculadosGrupoUSD.valorTotalOriginal * proporcion * valorDolarUsado);
            nuevosValores.iva = Math.round(valoresRecalculadosGrupoUSD.ivaOriginal * proporcion * valorDolarUsado);

            // Ajuste
            nuevosAjustes.ajusteManualUSD = ajusteManualUSD * proporcion;

            batch.update(doc.ref, { 
                'valores': nuevosValores,
                'ajustes': nuevosAjustes,
                'edicionesManuales.valores.valorHuesped': true,
                'edicionesManuales.valores.valorTotal': true,
                'edicionesManuales.valores.iva': true,
                'edicionesManuales.valores.valorHuespedOriginal': true,
                'edicionesManuales.valores.valorTotalOriginal': true,
                'edicionesManuales.valores.ivaOriginal': true,
                'ajusteManualRealizado': true
            });
        });

    } else {
        // Distribuir basado en la proporción original
        docs.forEach(doc => {
            const reserva = doc.data();
            const valorHuespedActualIndividual = reserva.valores.valorHuesped || 0;
            const proporcion = valorHuespedActualIndividual / totalHuespedActualCLP;

            const nuevosValores = { ...reserva.valores };
            const nuevosAjustes = { ...reserva.ajustes };

            // Set "Actual" (USD)
            nuevosValores.valorHuespedOriginal = valoresRecalculadosGrupoUSD.valorHuespedOriginal * proporcion;
            nuevosValores.valorTotalOriginal = valoresRecalculadosGrupoUSD.valorTotalOriginal * proporcion;
            nuevosValores.ivaOriginal = valoresRecalculadosGrupoUSD.ivaOriginal * proporcion;
            
            // Set "Actual" (CLP)
            nuevosValores.valorHuesped = Math.round(nuevoTotalHuespedCLP * proporcion);
            nuevosValores.valorTotal = Math.round(valoresRecalculadosGrupoUSD.valorTotalOriginal * proporcion * valorDolarUsado);
            nuevosValores.iva = Math.round(valoresRecalculadosGrupoUSD.ivaOriginal * proporcion * valorDolarUsado);

            // Ajuste
            nuevosAjustes.ajusteManualUSD = ajusteManualUSD * proporcion;

            batch.update(doc.ref, { 
                'valores': nuevosValores,
                'ajustes': nuevosAjustes,
                'edicionesManuales.valores.valorHuesped': true,
                'edicionesManuales.valores.valorTotal': true,
                'edicionesManuales.valores.iva': true,
                'edicionesManuales.valores.valorHuespedOriginal': true,
                'edicionesManuales.valores.valorTotalOriginal': true,
                'edicionesManuales.valores.ivaOriginal': true,
                'ajusteManualRealizado': true
            });
        });
    }

    // --- FIN DE LA LÓGICA DE RECÁLCULO ---

    await batch.commit();
};

const calcularPotencialGrupo = async (db, empresaId, idsIndividuales, descuento) => {
    const batch = db.batch();
    for (const id of idsIndividuales) {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        const doc = await ref.get();
        if(doc.exists) {
            const valorHuesped = doc.data().valores.valorHuesped || 0;
            if (valorHuesped > 0 && descuento > 0 && descuento < 100) {
                const valorPotencial = Math.round(valorHuesped / (1 - (parseFloat(descuento) / 100)));
                
                batch.update(ref, { 
                    'valores.valorPotencial': valorPotencial,
                    'edicionesManuales.valores.valorPotencial': true,
                    'potencialCalculado': true
                });
            }
        }
    }
    await batch.commit();
};

module.exports = {
    actualizarValoresGrupo,
    calcularPotencialGrupo
};