/**
 * Restricciones de fechas para reserva web pública (OTA-lite / parity inventario básico).
 * Empresa: websiteSettings.booking; por alojamiento: websiteData.booking (misma forma).
 */
const { isValid, differenceInDays, addMonths, parseISO, format, startOfDay } = require('date-fns');

function _parseLlegadaSalida(fechaLlegada, fechaSalida) {
    const lleg = String(fechaLlegada || '').slice(0, 10);
    const sal = String(fechaSalida || '').slice(0, 10);
    const startR = parseISO(`${lleg}T12:00:00`);
    const endR = parseISO(`${sal}T12:00:00`);
    return { lleg, sal, startR, endR };
}

function _mergeMinNoches(bookingCfg, propsData) {
    const minEmpresa = Math.max(1, parseInt(String(bookingCfg?.minNoches ?? '1'), 10) || 1);
    let minNochesR = minEmpresa;
    for (const p of propsData || []) {
        const m = Math.max(
            1,
            parseInt(String(p?.websiteData?.booking?.minNoches ?? minEmpresa), 10) || minEmpresa,
        );
        minNochesR = Math.max(minNochesR, m);
    }
    return minNochesR;
}

function _mergeMaxNochesEstadia(bookingCfg, propsData) {
    const emp = parseInt(String(bookingCfg?.maxNochesEstadia ?? '0'), 10) || 0;
    let cap = emp > 0 ? emp : 0;
    for (const p of propsData || []) {
        const pm = parseInt(String(p?.websiteData?.booking?.maxNochesEstadia ?? '0'), 10) || 0;
        if (pm > 0) cap = cap > 0 ? Math.min(cap, pm) : pm;
    }
    return cap;
}

function _mergeMesesReservableAdelante(bookingCfg, propsData) {
    const emp = parseInt(String(bookingCfg?.mesesReservableAdelante ?? '0'), 10) || 0;
    let meses = emp > 0 ? emp : 0;
    for (const p of propsData || []) {
        const pm = parseInt(String(p?.websiteData?.booking?.mesesReservableAdelante ?? '0'), 10) || 0;
        if (pm > 0) meses = meses > 0 ? Math.min(meses, pm) : pm;
    }
    return meses;
}

function _mergeMinDiasAnticipacionReserva(bookingCfg, propsData) {
    const emp = Math.max(0, parseInt(String(bookingCfg?.minDiasAnticipacionReserva ?? '0'), 10) || 0);
    let need = emp;
    for (const p of propsData || []) {
        const pa = Math.max(0, parseInt(String(p?.websiteData?.booking?.minDiasAnticipacionReserva ?? '0'), 10) || 0);
        need = Math.max(need, pa);
    }
    return need;
}

/**
 * @param {object} bookingCfg websiteSettings.booking
 * @param {object[]} propsData alojamientos con websiteData.booking opcional
 * @param {string} fechaLlegada YYYY-MM-DD
 * @param {string} fechaSalida YYYY-MM-DD
 * @param {'es'|'en'} locale
 * @returns {string|null} mensaje de error o null si OK
 */
function validarRestriccionesFechasReservaWeb(bookingCfg, propsData, fechaLlegada, fechaSalida, locale = 'es') {
    const en = locale === 'en';
    const { lleg, sal, startR, endR } = _parseLlegadaSalida(fechaLlegada, fechaSalida);
    if (!lleg || !sal || !isValid(startR) || !isValid(endR) || endR <= startR) {
        return en ? 'Invalid check-in or check-out dates.' : 'Las fechas de llegada o salida no son válidas.';
    }

    const nights = differenceInDays(endR, startR);
    const minNochesR = _mergeMinNoches(bookingCfg || {}, propsData || []);
    if (nights < minNochesR) {
        return en
            ? `Minimum stay is ${minNochesR} night(s).`
            : `La estadía debe ser de al menos ${minNochesR} noche(s).`;
    }

    const maxCap = _mergeMaxNochesEstadia(bookingCfg || {}, propsData || []);
    if (maxCap > 0 && nights > maxCap) {
        return en
            ? `Stay cannot exceed ${maxCap} night(s).`
            : `La estadía no puede superar ${maxCap} noche(s).`;
    }

    const mesesLim = _mergeMesesReservableAdelante(bookingCfg || {}, propsData || []);
    if (mesesLim > 0) {
        const lim = addMonths(startOfDay(new Date()), mesesLim);
        const limStr = format(lim, 'yyyy-MM-dd');
        if (lleg > limStr) {
            return en
                ? `Check-in must be within ${mesesLim} month(s) from today.`
                : `La fecha de llegada no puede ser más allá de ${mesesLim} mes(es) desde hoy.`;
        }
    }

    const antNeed = _mergeMinDiasAnticipacionReserva(bookingCfg || {}, propsData || []);
    if (antNeed > 0) {
        const diasHastaLlegada = differenceInDays(startR, startOfDay(new Date()));
        if (diasHastaLlegada < antNeed) {
            return en
                ? `Check-in must be at least ${antNeed} day(s) from today.`
                : `La llegada debe ser al menos ${antNeed} día(s) después de hoy.`;
        }
    }

    return null;
}

/**
 * Misma regla que `validarRestriccionesFechasReservaWeb`, con códigos estables para API / IA.
 * @returns {{ ok: boolean, codigo: string|null, noches_solicitadas?: number, minimo_noches?: number, maximo_noches?: number, meses_reservable_adelante?: number, anticipacion_dias_necesarios?: number, mensaje_es?: string, reglas_resumen?: object }}
 */
function evaluarRestriccionesReservaWebCodigo(bookingCfg, propsData, fechaLlegada, fechaSalida) {
    const { lleg, sal, startR, endR } = _parseLlegadaSalida(fechaLlegada, fechaSalida);
    if (!lleg || !sal || !isValid(startR) || !isValid(endR) || endR <= startR) {
        return {
            ok: false,
            codigo: 'fechas_invalidas',
            mensaje_es: 'Las fechas de llegada o salida no son válidas.',
        };
    }
    const nights = differenceInDays(endR, startR);
    const minNochesR = _mergeMinNoches(bookingCfg || {}, propsData || []);
    if (nights < minNochesR) {
        return {
            ok: false,
            codigo: 'minimo_noches',
            noches_solicitadas: nights,
            minimo_noches: minNochesR,
            mensaje_es: `La estadía debe ser de al menos ${minNochesR} noche(s).`,
        };
    }
    const maxCap = _mergeMaxNochesEstadia(bookingCfg || {}, propsData || []);
    if (maxCap > 0 && nights > maxCap) {
        return {
            ok: false,
            codigo: 'maximo_noches',
            noches_solicitadas: nights,
            maximo_noches: maxCap,
            mensaje_es: `La estadía no puede superar ${maxCap} noche(s).`,
        };
    }
    const mesesLim = _mergeMesesReservableAdelante(bookingCfg || {}, propsData || []);
    const antNeed = _mergeMinDiasAnticipacionReserva(bookingCfg || {}, propsData || {});
    if (mesesLim > 0) {
        const lim = addMonths(startOfDay(new Date()), mesesLim);
        const limStr = format(lim, 'yyyy-MM-dd');
        if (lleg > limStr) {
            return {
                ok: false,
                codigo: 'ventana_reserva_meses',
                meses_reservable_adelante: mesesLim,
                mensaje_es: `La fecha de llegada no puede ser más allá de ${mesesLim} mes(es) desde hoy.`,
            };
        }
    }
    if (antNeed > 0) {
        const diasHastaLlegada = differenceInDays(startR, startOfDay(new Date()));
        if (diasHastaLlegada < antNeed) {
            return {
                ok: false,
                codigo: 'anticipacion_minima',
                anticipacion_dias_necesarios: antNeed,
                dias_hasta_llegada: diasHastaLlegada,
                mensaje_es: `La llegada debe ser al menos ${antNeed} día(s) después de hoy.`,
            };
        }
    }
    return {
        ok: true,
        codigo: null,
        noches_solicitadas: nights,
        reglas_resumen: {
            minimo_noches: minNochesR,
            maximo_noches_estadia: maxCap > 0 ? maxCap : null,
            meses_reservable_adelante: mesesLim > 0 ? mesesLim : null,
            anticipacion_dias: antNeed > 0 ? antNeed : null,
        },
    };
}

/**
 * Misma lógica que al validar `crearReservaPublica` / `calcular-precio`, para SSR (ficha + widget).
 * @param {object} [bookingCfg] websiteSettings.booking empresa
 * @param {object} [propiedadBooking] websiteData.booking de un alojamiento
 */
function mergeRestriccionesBookingEmpresaUnaPropiedad(bookingCfg, propiedadBooking) {
    const pb = propiedadBooking && typeof propiedadBooking === 'object' ? propiedadBooking : {};
    const propsData = [{ websiteData: { booking: pb } }];
    const cfg = bookingCfg && typeof bookingCfg === 'object' ? bookingCfg : {};
    return {
        minNoches: _mergeMinNoches(cfg, propsData),
        maxNochesEstadia: _mergeMaxNochesEstadia(cfg, propsData),
        mesesReservableAdelante: _mergeMesesReservableAdelante(cfg, propsData),
        minDiasAnticipacionReserva: _mergeMinDiasAnticipacionReserva(cfg, propsData),
    };
}

module.exports = {
    validarRestriccionesFechasReservaWeb,
    evaluarRestriccionesReservaWebCodigo,
    mergeRestriccionesBookingEmpresaUnaPropiedad,
};
