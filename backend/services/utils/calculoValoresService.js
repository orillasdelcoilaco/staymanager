// backend/services/utils/calculoValoresService.js
// --- Cerebro Central para Lógica de Valores de Reservas ---

const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('../dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');


/**
 * FUNCIÓN 1: CÁLCULO INICIAL (LA FÓRMULA)
 * (Función de G-049)
 */
const calcularValoresBaseDesdeReporte = (datosMapeo, configuracionIva) => {
    // 1. Leer los valores del reporte (en USD)
    const valorAnfitrion_Orig = datosMapeo.valorAnfitrion || 0; // Payout
    const comisionSumable_Orig = datosMapeo.comisionSumable || 0;
    const costoCanal_Informativo_Orig = datosMapeo.costoCanal || 0;

    // 2. Calcular el Subtotal (Payout + Comisión Sumable)
    const subtotal_Orig = valorAnfitrion_Orig + comisionSumable_Orig;

    // 3. Determinar el IVA final y el Total Cliente
    let iva_Final_Orig;
    let valorHuesped_Final_Orig; // Este es el Total Cliente

    if (configuracionIva === 'agregar') {
        iva_Final_Orig = subtotal_Orig * 0.19;
        valorHuesped_Final_Orig = subtotal_Orig + iva_Final_Orig;
    } else {
        valorHuesped_Final_Orig = subtotal_Orig; // Total Cliente = Subtotal
        iva_Final_Orig = valorHuesped_Final_Orig / 1.19 * 0.19; // (informativo)
    }
    
    // 4. Crear el objeto de valores completo
    return {
        // --- Set "Actual" (USD) ---
        valorHuespedOriginal: valorHuesped_Final_Orig,
        valorTotalOriginal: valorAnfitrion_Orig, // Payout
        comisionOriginal: comisionSumable_Orig,
        costoCanalOriginal: costoCanal_Informativo_Orig,
        ivaOriginal: iva_Final_Orig,

        // --- SET DE RESPALDO / "ANCLA" (Tu idea de "dos pares de valores") ---
        valorHuespedCalculado: valorHuesped_Final_Orig,
        valorTotalCalculado: valorAnfitrion_Orig,
        comisionCalculado: comisionSumable_Orig,
        costoCanalCalculado: costoCanal_Informativo_Orig,
        ivaCalculado: iva_Final_Orig
    };
};

/**
 * FUNCIÓN 2: RECÁLCULO (LA MODIFICACIÓN)
 * (Función de G-049)
 */
const recalcularValoresDesdeTotal = (nuevoTotalClienteUSD, configuracionIva, comisionSumableUSD) => {
    let nuevoSubtotalUSD, nuevoIvaUSD, nuevoPayoutUSD;

    if (configuracionIva === 'agregar') {
        nuevoSubtotalUSD = nuevoTotalClienteUSD / 1.19;
        nuevoIvaUSD = nuevoTotalClienteUSD - nuevoSubtotalUSD;
    } else { // 'incluido'
        nuevoSubtotalUSD = nuevoTotalClienteUSD;
        nuevoIvaUSD = nuevoTotalClienteUSD / 1.19 * 0.19; // (informativo)
    }
    
    nuevoPayoutUSD = nuevoSubtotalUSD - comisionSumableUSD;

    return {
        valorHuespedOriginal: nuevoTotalClienteUSD,
        valorTotalOriginal: nuevoPayoutUSD, 
        ivaOriginal: nuevoIvaUSD, 
    };
};


/**
 * FUNCIÓN 3: VALORIZACIÓN (EL DÓLAR)
 * (Función de G-049)
 */
const getValoresCLP = async (db, empresaId, reserva) => {
    const valores = reserva.valores || {};
    const moneda = reserva.moneda || 'CLP';

    const valorHuespedOriginal = valores.valorHuespedOriginal || 0;
    const costoCanalOriginal = valores.costoCanalOriginal || 0;
    const payoutOriginal = valores.valorTotalOriginal || 0;
    const ivaOriginal = valores.ivaOriginal || 0;
    const comisionOriginal = valores.comisionOriginal || 0;

    let valorHuespedCLP, costoCanalCLP, payoutCLP, ivaCLP, comisionCLP;
    let valorDolarUsado = null;

    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : null;
    const esFacturado = reserva.estadoGestion === 'Facturado';
    const esPasado = fechaLlegada && fechaLlegada < fechaActual;
    const esFijo = esFacturado || esPasado;

    if (moneda !== 'CLP') {
        if (esFijo) {
            if (esFacturado) {
                valorDolarUsado = reserva.valores?.valorDolarFacturacion || null;
            }
            if (!valorDolarUsado && fechaLlegada) {
                valorDolarUsado = await obtenerValorDolar(db, empresaId, fechaLlegada);
            }
            if (!valorDolarUsado) {
                 valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
            }

            valorHuespedCLP = valores.valorHuesped || (valorHuespedOriginal * valorDolarUsado);
            costoCanalCLP = valores.costoCanal || (costoCanalOriginal * valorDolarUsado);
            payoutCLP = valores.valorTotal || (payoutOriginal * valorDolarUsado);
            ivaCLP = valores.iva || (ivaOriginal * valorDolarUsado);
            comisionCLP = valores.comision || (comisionOriginal * valorDolarUsado);

        } else {
            const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
            const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950;
            
            valorHuespedCLP = valorHuespedOriginal * valorDolarHoy;
            costoCanalCLP = costoCanalOriginal * valorDolarHoy;
            payoutCLP = payoutOriginal * valorDolarHoy;
            ivaCLP = ivaOriginal * valorDolarHoy;
            comisionCLP = comisionOriginal * valorDolarHoy;
            valorDolarUsado = valorDolarHoy;
        }
    } else {
        // --- INICIO DE LA CORRECCIÓN ---
        // Si la moneda es CLP, leemos los campos principales (CLP), no los '...Original' (USD).
        valorHuespedCLP = valores.valorHuesped || 0;
        costoCanalCLP = valores.costoCanal || 0;
        payoutCLP = valores.valorTotal || 0;
        ivaCLP = valores.iva || 0;
        comisionCLP = valores.comision || 0;
        // --- FIN DE LA CORRECCIÓN ---
    }

    return {
        valorHuesped: Math.round(valorHuespedCLP),
        costoCanal: Math.round(costoCanalCLP),
        payout: Math.round(payoutCLP),
        iva: Math.round(ivaCLP),
        comision: Math.round(comisionCLP),
        valorDolarUsado: valorDolarUsado,
        esValorFijo: esFijo
    };
};

/**
 * FUNCIÓN 4: CÁLCULO DE KPI (SIMULADOR)
 * (Función de G-056, movida aquí)
 */
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };

    const valorDolarDia = valorDolarDiaOverride ??
                          ((canalPorDefecto.moneda === 'USD' || canalObjetivo.moneda === 'USD')
dot                           ? await obtenerValorDolar(db, empresaId, startDate)
                              : null);

    let totalPrecioOriginal = 0;
    const priceDetails = [];
    let totalNights = 0;

    if (isSegmented) {
        const daySet = new Set(); 
        
        for (const dailyOption of items) {
            const currentDate = dailyOption.date;
            daySet.add(format(currentDate, 'yyyy-MM-dd'));
            const option = dailyOption.option;
            const propertiesForDay = Array.isArray(option) ? option : [option];
            
            let dailyRateBase = 0;
            for (const prop of propertiesForDay) {
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );
                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    dailyRateBase += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
                } else {
                    console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')} (segmentado)`);
                }
            }

            let dailyRateModified = dailyRateBase;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    dailyRateModified *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    dailyRateModified += canalObjetivo.modificadorValor;
                }
            }

            let dailyRateInTargetCurrency = dailyRateModified;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                dailyRateInTargetCurrency = dailyRateModified * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                 dailyRateInTargetCurrency = valorDolarDia > 0 ? (dailyRateModified / valorDolarDia) : 0;
            }

            totalPrecioOriginal += dailyRateInTargetCurrency;

             priceDetails.push({
                 date: format(currentDate, 'yyyy-MM-dd'),
                 properties: propertiesForDay.map(p => ({id: p.id, nombre: p.nombre})),
                 dailyRate: dailyRateInTargetCurrency
             });
        }
        totalNights = daySet.size;

section   } else {
        // --- MODO NORMAL (NO SEGMENTADO) ---
        totalNights = differenceInDays(endDate, startDate);
        if (totalNights <= 0) {
            return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };
        }

        for (const prop of items) {
            let propPrecioBaseTotal = 0;
            for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
                const currentDate = new Date(d);
                const tarifasDelDia = allTarifas.filter(t =>
               t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                 t.fechaTermino >= currentDate
a               );
                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    propPrecioBaseTotal += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
             } else {
                     console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')}`);
                }
            }

            let precioPropModificado = propPrecioBaseTotal;
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificado *= (1 + (canalObjetivo.modificadorValor / 100));
         } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    precioPropModificado += (canalObjetivo.modificadorValor * totalNights);
                }
            }

            let precioPropEnMonedaObjetivo = precioPropModificado;
image.png
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                  if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
              if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
               precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificado / valorDolarDia) : 0;
            }

            totalPrecioOriginal += precioPropEnMonedaObjetivo;

            priceDetails.push({
                nombre: prop.nombre,
                id: prop.id,
                precioTotal: precioPropEnMonedaObjetivo,
             precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
            });
        }
    }

    let totalPriceCLP = totalPrecioOriginal;
    if (canalObjetivo.moneda === 'USD') {
         if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para calcular el total en CLP desde USD.");
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),
         totalPriceOriginal: totalPrecioOriginal,
        currencyOriginal: canalObjetivo.moneda,
        valorDolarDia: valorDolarDia,
        nights: totalNights,
        details: priceDetails
    };
}


module.exports = {
*     calcularValoresBaseDesdeReporte,
    recalcularValoresDesdeTotal,
    getValoresCLP,
    calculatePrice
};