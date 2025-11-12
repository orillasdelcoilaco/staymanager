// backend/services/utils/calculoValoresService.js
// --- Cerebro Central para Lógica de Valores de Reservas ---

const admin = require('firebase-admin');
const { obtenerValorDolar, obtenerValorDolarHoy } = require('../dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

/**
 * FUNCIÓN 1: CÁLCULO INICIAL (LA FÓRMULA)
 * Toma los datos crudos del mapeo (en moneda original) y aplica la fórmula del canal.
 * Devuelve el set de 5 valores "Actuales" y el set de 5 valores "Ancla" (Respaldo).
 * * Usado por: sincronizacionService.js
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
        // Caso 1: "Agregar 19% de iva al total"
        iva_Final_Orig = subtotal_Orig * 0.19;
        valorHuesped_Final_Orig = subtotal_Orig + iva_Final_Orig;
    } else {
        // Caso 2: "iva ya esta incluido en los montos"
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
 * Toma un NUEVO Total Cliente (en USD) y recalcula todos los demás valores.
 * Devuelve un objeto con los 5 valores "Actuales" (USD) actualizados.
 * * Usado por: reservasService.js (actualizarReservaManualmente)
 * Usado por: propuestasService.js
 */
const recalcularValoresDesdeTotal = (nuevoTotalClienteUSD, configuracionIva, comisionSumableUSD) => {
    let nuevoSubtotalUSD, nuevoIvaUSD, nuevoPayoutUSD;

    if (configuracionIva === 'agregar') {
        // Total = Subtotal + IVA
        nuevoSubtotalUSD = nuevoTotalClienteUSD / 1.19;
        nuevoIvaUSD = nuevoTotalClienteUSD - nuevoSubtotalUSD;
    } else { // 'incluido'
        // Total = Subtotal
        nuevoSubtotalUSD = nuevoTotalClienteUSD;
        nuevoIvaUSD = nuevoTotalClienteUSD / 1.19 * 0.19; // (informativo)
    }
    
    // Payout = Subtotal - Comisión Sumable
    nuevoPayoutUSD = nuevoSubtotalUSD - comisionSumableUSD;

    return {
        valorHuespedOriginal: nuevoTotalClienteUSD, // Total Cliente "Actual"
        valorTotalOriginal: nuevoPayoutUSD,     // Payout "Actual"
        ivaOriginal: nuevoIvaUSD,             // IVA "Actual"
        // (comisionOriginal y costoCanalOriginal no cambian)
    };
};


/**
 * FUNCIÓN 3: VALORIZACIÓN (EL DÓLAR)
 * Lee los 5 valores "Actuales" (USD) de una reserva y los convierte a CLP
 * usando la lógica de "valor fijo" (Facturado o Pasado) o "flotante".
 * * Usado por: reservasService.js (obtenerReservaPorId)
 * Usado por: gestionService.js (getReservasPendientes)
 * Usado por: clientesService.js (recalcularEstadisticasClientes)
 */
const getValoresCLP = async (db, empresaId, reserva) => {
    const valores = reserva.valores || {};
    const moneda = reserva.moneda || 'CLP';

    // 1. Leer los 5 valores "Actuales" (USD)
    const valorHuespedOriginal = valores.valorHuespedOriginal || 0;
    const costoCanalOriginal = valores.costoCanalOriginal || 0;
    const payoutOriginal = valores.valorTotalOriginal || 0;
    const ivaOriginal = valores.ivaOriginal || 0;
    const comisionOriginal = valores.comisionOriginal || 0;

    let valorHuespedCLP, costoCanalCLP, payoutCLP, ivaCLP, comisionCLP;
    let valorDolarUsado = null;

    // 2. Definir condiciones de valor fijo (Tu regla)
    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);
    const fechaLlegada = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : null;
    const esFacturado = reserva.estadoGestion === 'Facturado';
    const esPasado = fechaLlegada && fechaLlegada < fechaActual;
    const esFijo = esFacturado || esPasado;

    if (moneda !== 'CLP') {
        if (esFijo) {
            // 3. Caso Estático (Facturado o Pasado)
            // Busca el dólar "congelado"
            if (esFacturado) {
                valorDolarUsado = reserva.valores?.valorDolarFacturacion || null;
            }
            // Si no está facturado (es pasado), busca el dólar de la fecha de llegada
            if (!valorDolarUsado && fechaLlegada) {
                valorDolarUsado = await obtenerValorDolar(db, empresaId, fechaLlegada);
            }
            // Fallback final si todo falla
            if (!valorDolarUsado) {
                 valorDolarUsado = (await obtenerValorDolarHoy(db, empresaId)).valor;
            }

            // Usar valores CLP ya guardados (congelados)
            valorHuespedCLP = valores.valorHuesped || (valorHuespedOriginal * valorDolarUsado);
            costoCanalCLP = valores.costoCanal || (costoCanalOriginal * valorDolarUsado);
            payoutCLP = valores.valorTotal || (payoutOriginal * valorDolarUsado);
            ivaCLP = valores.iva || (ivaOriginal * valorDolarUsado);
            comisionCLP = valores.comision || (comisionOriginal * valorDolarUsado);

        } else {
            // 4. Caso Flotante: Recalcular desde USD con dólar de HOY
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
        // 5. Caso Estático (CLP) - Los valores "...Original" ya son CLP
        valorHuespedCLP = valorHuespedOriginal || 0;
        costoCanalCLP = costoCanalOriginal || 0;
        payoutCLP = payoutOriginal || 0;
        ivaCLP = ivaOriginal || 0;
        comisionCLP = comisionOriginal || 0;
    }

    return {
        // Los 5 valores en CLP
        valorHuesped: Math.round(valorHuespedCLP),
        costoCanal: Math.round(costoCanalCLP),
        payout: Math.round(payoutCLP),
        iva: Math.round(ivaCLP),
        comision: Math.round(comisionCLP),
        
        // Metadatos
        valorDolarUsado: valorDolarUsado,
        esValorFijo: esFijo
    };
};

// (Pegar esta función completa dentro de calculoValoresService.js,
// después de getValoresCLP y antes de module.exports)

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
                              ? await obtenerValorDolar(db, empresaId, startDate)
                              : null);

    let totalPrecioOriginal = 0;
    const priceDetails = [];
    let totalNights = 0;

    if (isSegmented) {
        // --- MODO ITINERARIO (SEGMENTADO) ---
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

    } else {
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
                );
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
    calcularValoresBaseDesdeReporte,
    recalcularValoresDesdeTotal,
    getValoresCLP,
    
};