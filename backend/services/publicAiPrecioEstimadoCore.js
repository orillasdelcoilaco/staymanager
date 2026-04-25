/**
 * Lógica interna de cotización para detalle IA (usada por publicAiPrecioEstimadoService).
 */
const admin = require('firebase-admin');
const pool = require('../db/postgres');
const { format } = require('date-fns');
const { getAvailabilityData, calculatePrice } = require('./publicWebsiteService');
const { fetchTarifasYCanal } = require('../routes/website.shared');
const { buildDesglosePrecioCheckout } = require('./checkoutDesgloseService');

function sumExtrasCLP(desglose) {
    const extras = desglose?.lineasExtraResueltas;
    if (!Array.isArray(extras)) return 0;
    return extras.reduce((s, x) => s + (Math.round(Number(x.montoCLP) || 0) || 0), 0);
}

function buildBaseMeta(inicio, fin, monedaIn) {
    return {
        checkin: format(inicio, 'yyyy-MM-dd'),
        checkout: format(fin, 'yyyy-MM-dd'),
        moneda: monedaIn,
        motor: 'publicWebsiteService.calculatePrice',
        noches: 0,
    };
}

function gatePool(baseMeta) {
    if (!pool) {
        return {
            ...baseMeta,
            disponible: null,
            calculo_ok: false,
            codigo: 'SERVICE_UNAVAILABLE',
            mensaje: 'La cotización y disponibilidad requieren PostgreSQL.',
        };
    }
    return null;
}

function gateCapacidad(baseMeta, cap, huespedes) {
    if (cap > 0 && huespedes > cap) {
        return {
            ...baseMeta,
            disponible: false,
            calculo_ok: false,
            codigo: 'CAPACIDAD',
            mensaje: `La propiedad admite hasta ${cap} huéspedes; se solicitaron ${huespedes}.`,
        };
    }
    return null;
}

async function gateCanalYTarifas(empresaId, monedaOpt, baseMeta) {
    const { canalPorDefectoId, canalMoneda, allTarifas } = await fetchTarifasYCanal(empresaId);
    const monedaEfectiva = canalMoneda || monedaOpt || 'CLP';
    const meta = { ...baseMeta, moneda: monedaEfectiva };
    if (!canalPorDefectoId) {
        return { error: { ...meta, disponible: null, calculo_ok: false, codigo: 'SIN_CANAL_DEFECTO' } };
    }
    return { meta, monedaEfectiva, allTarifas };
}

async function gateDisponibilidad(db, empresaId, propiedadId, inicio, fin, baseMeta) {
    const availabilityData = await getAvailabilityData(db, empresaId, inicio, fin, false, null);
    const ok = availabilityData.availableProperties.some((p) => String(p.id) === String(propiedadId));
    if (!ok) {
        return {
            ...baseMeta,
            disponible: false,
            calculo_ok: false,
            codigo: 'NOT_AVAILABLE',
        };
    }
    return null;
}

async function invokeCalculatePriceWeb(db, empresaId, propiedadId, nombrePropiedad, inicio, fin, allTarifas) {
    try {
        const data = await calculatePrice(
            db,
            empresaId,
            [{ id: propiedadId, nombre: nombrePropiedad || 'Alojamiento' }],
            inicio,
            fin,
            allTarifas
        );
        return { err: null, data };
    } catch (e) {
        return { err: e, data: null };
    }
}

function gatePrecioCero(baseMeta, precioCalculado) {
    const noches = precioCalculado?.nights || 0;
    const totalAloj = Math.round(Number(precioCalculado?.totalPriceCLP) || 0);
    if (!precioCalculado || totalAloj <= 0) {
        return {
            ...baseMeta,
            noches,
            disponible: true,
            calculo_ok: false,
            codigo: 'NO_PRICING',
        };
    }
    return null;
}

function buildExitoPayload(baseMeta, monedaEfectiva, noches, totalAloj, desglose) {
    const extrasSum = sumExtrasCLP(desglose);
    const lineasPublicas = (desglose.lineas || []).map((ln) => ({
        key: ln.key,
        etiqueta: ln.etiqueta,
        monto_clp: Math.round(Number(ln.montoCLP) || 0),
        es_extra: !!ln.esExtra,
    }));

    return {
        checkin: baseMeta.checkin,
        checkout: baseMeta.checkout,
        moneda: monedaEfectiva,
        motor: baseMeta.motor,
        noches,
        disponible: true,
        calculo_ok: true,
        subtotal_alojamiento_clp: totalAloj,
        promedio_noche_clp: noches > 0 ? Math.round(totalAloj / noches) : null,
        desglose_checkout: desglose.mostrar
            ? {
                  modelo: desglose.modelo,
                  total_base_clp: totalAloj,
                  lineas: lineasPublicas,
                  extras_estimados_clp: extrasSum,
                  nota_pie: desglose.notaPie || null,
              }
            : null,
        referencia: {
            total_estadia_tarifas_clp: totalAloj,
            iva_desglosado_clp: desglose.ivaCLP != null ? Math.round(desglose.ivaCLP) : null,
            neto_desglosado_clp: desglose.netoCLP != null ? Math.round(desglose.netoCLP) : null,
        },
        aviso:
            'Misma lógica que la web pública (calcular-precio). No incluye cupones ni ajustes posteriores. Las líneas extra del desglose son referenciales como en checkout.',
    };
}

/**
 * Orquesta pasos de cotización (mantiene publicAiPrecioEstimadoService bajo límite de líneas por función).
 */
async function ejecutarCotizacionDetallePublico(opts) {
    const {
        empresaId,
        propiedadId,
        nombrePropiedad,
        inicio,
        fin,
        moneda = 'CLP',
        legal = null,
        adultos = 2,
        capacidadMax = 0,
    } = opts;

    const db = admin.firestore();
    let baseMeta = buildBaseMeta(inicio, fin, moneda);

    const g0 = gatePool(baseMeta);
    if (g0) return g0;

    const huespedes = Math.max(1, Math.min(50, Math.round(Number(adultos) || 2)));
    const cap = Math.max(0, Math.round(Number(capacidadMax) || 0));
    const gCap = gateCapacidad(baseMeta, cap, huespedes);
    if (gCap) return gCap;

    const canalCtx = await gateCanalYTarifas(empresaId, moneda, baseMeta);
    if (canalCtx.error) return canalCtx.error;
    baseMeta = canalCtx.meta;

    const gDisp = await gateDisponibilidad(db, empresaId, propiedadId, inicio, fin, baseMeta);
    if (gDisp) return gDisp;

    const { err: calcErr, data: precioCalculado } = await invokeCalculatePriceWeb(
        db,
        empresaId,
        propiedadId,
        nombrePropiedad,
        inicio,
        fin,
        canalCtx.allTarifas
    );
    if (calcErr) {
        return {
            ...baseMeta,
            disponible: true,
            calculo_ok: false,
            codigo: 'CALC_ERROR',
            mensaje: calcErr.message || String(calcErr),
        };
    }

    const gPz = gatePrecioCero(baseMeta, precioCalculado);
    if (gPz) return gPz;

    const noches = precioCalculado.nights || 0;
    const totalAloj = Math.round(Number(precioCalculado.totalPriceCLP) || 0);
    const desglose = buildDesglosePrecioCheckout(totalAloj, legal, 'es', { noches, huespedes });

    return buildExitoPayload(baseMeta, canalCtx.monedaEfectiva, noches, totalAloj, desglose);
}

module.exports = {
    ejecutarCotizacionDetallePublico,
};
