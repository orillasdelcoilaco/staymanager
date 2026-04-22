// backend/services/utils/calculoValoresService.js
// --- Cerebro Central para Lógica de Valores de Reservas ---

const pool = require('../../db/postgres');
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

function _mapearCanalPG(row) {
        return { id: row.id, nombre: row.nombre, comision: parseFloat(row.comision || 0), ...(row.metadata || {}) };
}

async function _resolverCanalesYDolar(db, empresaId, canalObjetivoId, startDate, valorDolarDiaOverride) {
        const [defectoRes, objetivoRes] = await Promise.all([
                pool.query(
                        `SELECT * FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
                        [empresaId]
                ),
                pool.query('SELECT * FROM canales WHERE id = $1 AND empresa_id = $2', [canalObjetivoId, empresaId]),
        ]);

        if (!objetivoRes.rows[0]) throw new Error("El canal de venta seleccionado no es válido.");

        const canalObjetivo   = _mapearCanalPG(objetivoRes.rows[0]);
        const canalPorDefecto = defectoRes.rows[0] ? _mapearCanalPG(defectoRes.rows[0]) : canalObjetivo;

        if (!defectoRes.rows[0] && !objetivoRes.rows[0]) throw new Error("No se ha configurado un canal por defecto y el canal objetivo no es válido.");

        const valorDolarDia = valorDolarDiaOverride ??
                ((canalPorDefecto.moneda === 'USD' || canalObjetivo.moneda === 'USD')
                        ? await obtenerValorDolar(db, empresaId, startDate)
                        : null);

        return { canalPorDefecto, canalObjetivo, valorDolarDia };
}

function _aplicarModificadorCanal(precioBase, canalObjetivo, canalPorDefecto, totalNights, esFijo) {
        if (canalObjetivo.id === canalPorDefecto.id || !canalObjetivo.modificadorValor) return precioBase;
        if (canalObjetivo.modificadorTipo === 'porcentaje') {
                return precioBase * (1 + (canalObjetivo.modificadorValor / 100));
        }
        if (canalObjetivo.modificadorTipo === 'fijo') {
                return precioBase + (esFijo ? canalObjetivo.modificadorValor : canalObjetivo.modificadorValor * totalNights);
        }
        return precioBase;
}

function _convertirMoneda(precio, canalPorDefecto, canalObjetivo, valorDolarDia) {
        if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                return precio * valorDolarDia;
        }
        if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                return valorDolarDia > 0 ? (precio / valorDolarDia) : 0;
        }
        return precio;
}

// Extrae el valor numérico de un precio que puede ser number (formato antiguo)
// o { valorCLP, valorUSD, moneda } (nuevo formato precios_canales JSONB)
function _extraerPrecioBase(precioObj, monedaCanal) {
        if (typeof precioObj === 'number') return precioObj;
        if (!precioObj || typeof precioObj !== 'object') return 0;
        return monedaCanal === 'USD' ? (precioObj.valorUSD || 0) : (precioObj.valorCLP || 0);
}

function _calcularPrecioSegmentado(items, allTarifas, canalPorDefecto, canalObjetivo, valorDolarDia) {
        let totalPrecioOriginal = 0;
        const priceDetails = [];
        const daySet = new Set();

        for (const dailyOption of items) {
                const currentDate = dailyOption.date;
                daySet.add(format(currentDate, 'yyyy-MM-dd'));
                const propertiesForDay = Array.isArray(dailyOption.option) ? dailyOption.option : [dailyOption.option];

                let dailyRateBase = 0;
                for (const prop of propertiesForDay) {
                        const tarifasDelDia = allTarifas.filter(t =>
                                t.alojamientoId === prop.id &&
                                t.fechaInicio <= currentDate &&
                                t.fechaTermino >= currentDate
                        );
                        if (tarifasDelDia.length > 0) {
                                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                                dailyRateBase += _extraerPrecioBase(tarifa.precios?.[canalPorDefecto.id], canalPorDefecto.moneda);
                        } else {
                                console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')} (segmentado)`);
                        }
                }

                const dailyRateModified = _aplicarModificadorCanal(dailyRateBase, canalObjetivo, canalPorDefecto, 1, true);
                const dailyRateInTargetCurrency = _convertirMoneda(dailyRateModified, canalPorDefecto, canalObjetivo, valorDolarDia);

                totalPrecioOriginal += dailyRateInTargetCurrency;
                priceDetails.push({
                        date: format(currentDate, 'yyyy-MM-dd'),
                        properties: propertiesForDay.map(p => ({ id: p.id, nombre: p.nombre })),
                        dailyRate: dailyRateInTargetCurrency
                });
        }

        return { totalPrecioOriginal, priceDetails, totalNights: daySet.size };
}

function _calcularPrecioNormal(items, allTarifas, canalPorDefecto, canalObjetivo, valorDolarDia, startDate, endDate) {
        const totalNights = differenceInDays(endDate, startDate);
        if (totalNights <= 0) {
                return { totalPrecioOriginal: 0, priceDetails: [], totalNights: 0, earlyReturn: true, canalObjetivo };
        }

        let totalPrecioOriginal = 0;
        const priceDetails = [];

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
                                propPrecioBaseTotal += _extraerPrecioBase(tarifa.precios?.[canalPorDefecto.id], canalPorDefecto.moneda);
                        } else {
                                console.warn(`[WARN] No se encontró tarifa base para ${prop.nombre} en fecha ${format(currentDate, 'yyyy-MM-dd')}`);
                        }
                }

                const precioPropModificado = _aplicarModificadorCanal(propPrecioBaseTotal, canalObjetivo, canalPorDefecto, totalNights, false);
                const precioPropEnMonedaObjetivo = _convertirMoneda(precioPropModificado, canalPorDefecto, canalObjetivo, valorDolarDia);

                totalPrecioOriginal += precioPropEnMonedaObjetivo;
                priceDetails.push({
                        nombre: prop.nombre,
                        id: prop.id,
                        precioTotal: precioPropEnMonedaObjetivo,
                        precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
                });
        }

        return { totalPrecioOriginal, priceDetails, totalNights };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {
        const { canalPorDefecto, canalObjetivo, valorDolarDia } = await _resolverCanalesYDolar(db, empresaId, canalObjetivoId, startDate, valorDolarDiaOverride);

        const { totalPrecioOriginal, priceDetails, totalNights, earlyReturn } = isSegmented
                ? _calcularPrecioSegmentado(items, allTarifas, canalPorDefecto, canalObjetivo, valorDolarDia)
                : _calcularPrecioNormal(items, allTarifas, canalPorDefecto, canalObjetivo, valorDolarDia, startDate, endDate);

        if (earlyReturn) {
                return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };
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
        calculatePrice
};