// backend/services/promocionesDisplayService.js
// Ofertas: websiteSettings.marketing.promocionesDestacadas y tarifas.metadata.promo (solo display).

const { parseISO, isValid, differenceInCalendarDays } = require('date-fns');

/**
 * @param {object} prop — propiedad con precioBaseNoche y opcionalmente pricing
 * @param {Array<object>} promos
 * @param {string|null} fechaLlegadaQuery YYYY-MM-DD
 * @param {string|null} fechaSalidaQuery YYYY-MM-DD
 */
function aplicarPromocionAPropiedad(prop, promos, fechaLlegadaQuery, fechaSalidaQuery) {
    if (!prop || prop.isGroup || !Array.isArray(promos) || promos.length === 0) return prop;
    for (const pr of promos) {
        if (!pr || typeof pr !== 'object') continue;
        if (pr.propiedadId && String(pr.propiedadId) !== String(prop.id)) continue;
        const desde = pr.fechaDesde ? String(pr.fechaDesde).slice(0, 10) : null;
        const hasta = pr.fechaHasta ? String(pr.fechaHasta).slice(0, 10) : null;
        if (desde && fechaLlegadaQuery && fechaLlegadaQuery < desde) continue;
        if (hasta && fechaSalidaQuery && fechaSalidaQuery > hasta) continue;
        const pct = Math.min(90, Math.max(0, Number(pr.porcentajeDescuento) || 0));
        let base = Number(prop.precioBaseNoche) || 0;
        if (prop.pricing && prop.pricing.totalPriceCLP > 0 && prop.pricing.nights > 0) {
            base = Math.round(prop.pricing.totalPriceCLP / prop.pricing.nights);
        }
        if (!base || base <= 0 || pct <= 0) continue;
        const promo = Math.round(base * (1 - pct / 100));
        return {
            ...prop,
            promoDisplay: {
                etiqueta: String(pr.etiqueta || 'Oferta').slice(0, 40),
                precioBase: base,
                precioPromo: promo,
                porcentaje: pct,
                origen: 'marketing',
            },
        };
    }
    return prop;
}

function nochesEstancia(fechaLlegadaStr, fechaSalidaStr) {
    if (!fechaLlegadaStr || !fechaSalidaStr) return null;
    const a = parseISO(`${String(fechaLlegadaStr).slice(0, 10)}T12:00:00`);
    const b = parseISO(`${String(fechaSalidaStr).slice(0, 10)}T12:00:00`);
    if (!isValid(a) || !isValid(b) || b <= a) return null;
    return differenceInCalendarDays(b, a);
}

function _ahorroPromoTarifa(ev, baseNoche) {
    if (!ev || !baseNoche || baseNoche <= 0) return 0;
    if (ev.modo === 'monto') return Math.min(ev.montoFijo, Math.max(0, baseNoche - 1));
    return baseNoche * (ev.pct / 100);
}

function _precioTrasPromoTarifa(ev, baseNoche) {
    if (!ev || !baseNoche || baseNoche <= 0) return baseNoche;
    if (ev.modo === 'monto') {
        return Math.max(0, Math.round(baseNoche - Math.min(ev.montoFijo, baseNoche - 1)));
    }
    return Math.round(baseNoche * (1 - ev.pct / 100));
}

function _pseudoPctPromo(ev, baseNoche) {
    if (!baseNoche || baseNoche <= 0) return 0;
    if (ev.modo === 'monto') return Math.min(90, Math.round((_ahorroPromoTarifa(ev, baseNoche) / baseNoche) * 100));
    return ev.pct;
}

/**
 * @returns {{ modo: 'pct', pct: number, etiqueta: string } | { modo: 'monto', montoFijo: number, etiqueta: string } | null}
 */
function evaluarPromoTarifa(promo, { fechaLlegadaQuery, fechaSalidaQuery }) {
    if (!promo || typeof promo !== 'object') return null;
    const activa = promo.activa !== false && promo.activa !== 'false';
    const monto = Math.max(0, Number(promo.montoFijoDescuento) || 0);
    const pct = Math.min(90, Math.max(0, Number(promo.porcentajeDescuento) || 0));
    if (!activa || (monto <= 0 && pct <= 0)) return null;

    const minN = Math.max(1, parseInt(promo.minNoches, 10) || 1);
    const noches = nochesEstancia(fechaLlegadaQuery, fechaSalidaQuery);
    if (noches != null && noches < minN) return null;

    const evDesde = promo.estanciaFechaDesde ? String(promo.estanciaFechaDesde).slice(0, 10) : null;
    const evHasta = promo.estanciaFechaHasta ? String(promo.estanciaFechaHasta).slice(0, 10) : null;
    if (evDesde && fechaLlegadaQuery && fechaLlegadaQuery < evDesde) return null;
    if (evHasta && fechaSalidaQuery && fechaSalidaQuery > evHasta) return null;

    const frDesde = promo.fechaReservaDesde ? String(promo.fechaReservaDesde).slice(0, 10) : null;
    const frHasta = promo.fechaReservaHasta ? String(promo.fechaReservaHasta).slice(0, 10) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (frDesde && today < frDesde) return null;
    if (frHasta && today > frHasta) return null;

    const etiqueta = String(promo.etiqueta || 'Oferta').slice(0, 40);
    if (monto > 0) return { modo: 'monto', montoFijo: monto, etiqueta };
    return { modo: 'pct', pct, etiqueta };
}

/**
 * Oferta ligada a la tarifa de la noche de llegada (metadata.promo). Tiene prioridad sobre marketing.
 */
function aplicarPromoDesdeTarifaMetadata(prop, allTarifas, canalPorDefectoId, fechaLlegadaQuery, fechaSalidaQuery) {
    if (!prop || prop.isGroup || !allTarifas?.length || !fechaLlegadaQuery || !canalPorDefectoId) return prop;
    const lleg = parseISO(`${String(fechaLlegadaQuery).slice(0, 10)}T12:00:00`);
    if (!isValid(lleg)) return prop;

    const candidatas = allTarifas.filter(
        (t) => String(t.alojamientoId) === String(prop.id)
            && t.fechaInicio <= lleg
            && t.fechaTermino >= lleg
    );
    candidatas.sort((a, b) => b.fechaInicio - a.fechaInicio);

    let base = Number(prop.precioBaseNoche) || 0;
    if (prop.pricing && prop.pricing.totalPriceCLP > 0 && prop.pricing.nights > 0) {
        base = Math.round(prop.pricing.totalPriceCLP / prop.pricing.nights);
    }
    if (!base || base <= 0) return prop;

    let best = null;
    let bestAhorro = 0;
    for (const t of candidatas) {
        const ev = evaluarPromoTarifa(t.metadata?.promo, { fechaLlegadaQuery, fechaSalidaQuery });
        if (!ev) continue;
        const ahorro = _ahorroPromoTarifa(ev, base);
        if (!best || ahorro > bestAhorro) {
            best = ev;
            bestAhorro = ahorro;
        }
    }
    if (!best || bestAhorro <= 0) return prop;

    const precioPromo = _precioTrasPromoTarifa(best, base);
    return {
        ...prop,
        promoDisplay: {
            etiqueta: best.etiqueta,
            precioBase: base,
            precioPromo,
            porcentaje: _pseudoPctPromo(best, base),
            modoPromo: best.modo,
            origen: 'tarifa',
        },
    };
}

/**
 * Precio de una noche en moneda del canal, aplicando la misma ventana que el display (min noches, estancia, reserva).
 * @param {number} precioBaseNoche
 * @param {object|undefined} promo — tarifa.metadata.promo
 * @param {string|null} fechaLlegadaEstancia YYYY-MM-DD
 * @param {string|null} fechaSalidaEstancia YYYY-MM-DD (checkout exclusivo, igual que consultas públicas)
 */
function precioNocheConPromoTarifa(precioBaseNoche, promo, fechaLlegadaEstancia, fechaSalidaEstancia) {
    const fl = fechaLlegadaEstancia ? String(fechaLlegadaEstancia).slice(0, 10) : null;
    const fs = fechaSalidaEstancia ? String(fechaSalidaEstancia).slice(0, 10) : null;
    const ev = evaluarPromoTarifa(promo, { fechaLlegadaQuery: fl, fechaSalidaQuery: fs });
    return _precioTrasPromoTarifa(ev, precioBaseNoche);
}

function aplicarPromocionesDisplayCompleto(prop, {
    promos, fechaLlegada, fechaSalida, allTarifas, canalPorDefectoId,
}) {
    let p = aplicarPromoDesdeTarifaMetadata(
        prop,
        allTarifas,
        canalPorDefectoId,
        fechaLlegada || null,
        fechaSalida || null
    );
    if (!p.promoDisplay) {
        p = aplicarPromocionAPropiedad(p, promos || [], fechaLlegada || null, fechaSalida || null);
    }
    return p;
}

module.exports = {
    aplicarPromocionAPropiedad,
    aplicarPromoDesdeTarifaMetadata,
    aplicarPromocionesDisplayCompleto,
    precioNocheConPromoTarifa,
};
