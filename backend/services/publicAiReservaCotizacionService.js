/**
 * Cotización previa a POST /api/reservas (IA): mismas reglas de fechas, calendario y precio que createPublicReservation,
 * sin insertar reserva ni cliente.
 */
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { parseISO, isValid } = require('date-fns');
const { resolveEmpresaDbId } = require('./resolveEmpresaDbId');
const { evaluarRestriccionesReservaWebCodigo } = require('./reservaWebRestriccionesService');
const { calculatePrice } = require('./utils/calculoValoresService');
const { obtenerTarifasParaConsumidores } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');
const {
    buildDesglosePrecioCheckout,
    buildAvisoPoliticaCancelacion,
} = require('./checkoutDesgloseService');
const { sqlReservaPrincipalSemanticaIgual } = require('./estadosService');
const { resolveBookingUnitForIa } = require('./publicAiBookingResolverService');
const { resolvePrecioNocheReferencia } = require('./publicAiProductSnapshot');

function _motivoRestriccion(restr) {
    if (!restr || restr.ok) return null;
    return {
        codigo: restr.codigo,
        noches_solicitadas: restr.noches_solicitadas,
        minimo_noches: restr.minimo_noches,
        maximo_noches: restr.maximo_noches,
        meses_reservable_adelante: restr.meses_reservable_adelante,
        anticipacion_dias_necesarios: restr.anticipacion_dias_necesarios,
        dias_hasta_llegada: restr.dias_hasta_llegada,
        mensaje_es: restr.mensaje_es,
    };
}

function _validarContactoOpcional(cliente) {
    if (!cliente || typeof cliente !== 'object') return null;
    const emailTrim = String(cliente.email || '').trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(emailTrim)) {
        return { error: 'INVALID_EMAIL', message: 'El email no tiene un formato válido.' };
    }
    const telRaw = String(cliente.telefono || '').trim();
    if (telRaw && !/^\+?[\d\s\-]{8,}$/.test(telRaw)) {
        return { error: 'INVALID_PHONE', message: 'El teléfono debe incluir al menos 8 dígitos (puede llevar + al inicio).' };
    }
    return null;
}

/**
 * @param {object} body — mismo criterio que createPublicReservation (empresa_id, alojamiento_id, checkin, checkout, personas, huesped opcional)
 * @returns {{ http: number, body: object }}
 */
async function cotizarReservaIaPublica(body) {
    if (!pool) {
        return { http: 503, body: { success: false, error: 'SERVICE_UNAVAILABLE', message: 'PostgreSQL requerido.' } };
    }

    const empresaRaw = body.empresa_id_raw || body.empresa_id || body.empresaId;
    let propiedadId = body.booking_id || body.propiedadId || body.alojamiento_id || body.property_id;
    const fechaInicio = body.fechaInicio || body.checkin;
    const fechaFin = body.fechaFin || body.checkout;
    let personas = parseInt(String(body.personas ?? ''), 10);
    if (Number.isNaN(personas) || personas < 1) {
        personas = Number(body.adultos || 0) + Number(body.ninos || 0);
    }
    if (!personas || personas < 1) personas = 2;

    let cliente = body.cliente || body.huesped;
    if (typeof cliente === 'string') {
        try {
            cliente = JSON.parse(cliente);
        } catch {
            cliente = null;
        }
    }
    const errContacto = _validarContactoOpcional(cliente);
    if (errContacto) {
        return { http: 400, body: { success: false, ...errContacto } };
    }

    const missing = [];
    if (!empresaRaw) missing.push('empresa_id');
    if (!propiedadId) missing.push('alojamiento_id');
    if (!fechaInicio) missing.push('checkin');
    if (!fechaFin) missing.push('checkout');
    if (missing.length) {
        return {
            http: 400,
            body: {
                success: false,
                error: 'MISSING_FIELDS',
                missing,
                message: `Faltan campos obligatorios: ${missing.join(', ')}`,
            },
        };
    }

    const empresaId = await resolveEmpresaDbId(empresaRaw);
    const inicio = parseISO(String(fechaInicio).slice(0, 10) + 'T00:00:00Z');
    const fin = parseISO(String(fechaFin).slice(0, 10) + 'T00:00:00Z');
    if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
        return { http: 400, body: { success: false, error: 'INVALID_DATES' } };
    }

    const { rows: empRows } = await pool.query(
        `SELECT id, nombre, configuracion FROM empresas WHERE id::text = $1::text LIMIT 1`,
        [String(empresaId)]
    );
    if (!empRows[0]) {
        return { http: 404, body: { success: false, error: 'EMPRESA_NOT_FOUND' } };
    }
    const cfg = empRows[0].configuracion && typeof empRows[0].configuracion === 'object' ? empRows[0].configuracion : {};
    const ws = cfg.websiteSettings && typeof cfg.websiteSettings === 'object' ? cfg.websiteSettings : {};
    const bookingCfg = ws.booking || {};
    const legal = ws.legal || {};

    const unidad = await resolveBookingUnitForIa({
        pool,
        empresaRaw,
        empresaId,
        catalogId: propiedadId,
        checkin: fechaInicio,
        checkout: fechaFin,
        personas,
    });
    if (!unidad.ok && unidad.code === 'PROPERTY_NOT_FOUND') {
        return {
            http: 404,
            body: {
                success: false,
                error: 'PROPERTY_NOT_FOUND',
                catalog_id_candidatos: unidad.catalog_id_candidatos || [],
            },
        };
    }
    if (!unidad.ok && unidad.code === 'NO_CAPACITY') {
        return {
            http: 200,
            body: {
                success: true,
                cotizacion_ok: false,
                motivo: {
                    codigo: 'NO_CAPACITY',
                    mensaje_es: `La unidad no admite ${personas} huéspedes.`,
                    capacidad: unidad.capacidad || null,
                },
            },
        };
    }
    if (!unidad.ok) {
        return { http: 422, body: { success: false, error: unidad.code || 'RESOLVE_ERROR' } };
    }
    propiedadId = unidad.booking_id;

    const { rows: propRows } = await pool.query(
        `SELECT id, nombre, capacidad, metadata
           FROM propiedades
          WHERE id::text = $1::text AND empresa_id::text = $2::text AND activo = true
          LIMIT 1`,
        [String(propiedadId), String(unidad.empresa_id)]
    );
    if (!propRows[0]) {
        return { http: 404, body: { success: false, error: 'PROPERTY_NOT_FOUND' } };
    }

    const meta = propRows[0].metadata && typeof propRows[0].metadata === 'object' ? propRows[0].metadata : {};
    const propsData = [{ websiteData: { booking: meta.websiteData?.booking } }];
    const restricciones = evaluarRestriccionesReservaWebCodigo(bookingCfg, propsData, fechaInicio, fechaFin);
    const base = {
        success: true,
        payload_version: 'cotizacion_reserva_ia_v1',
        requiere_confirmacion_final: true,
        empresa: { id: String(unidad.empresa_id), nombre: String(empRows[0].nombre || '').trim() },
        propiedad: { id: String(propRows[0].id), nombre: propRows[0].nombre },
        checkin: String(fechaInicio).slice(0, 10),
        checkout: String(fechaFin).slice(0, 10),
        personas,
        reglas_estadia: restricciones.ok ? restricciones.reglas_resumen : null,
    };

    if (!restricciones.ok) {
        return {
            http: 200,
            body: {
                ...base,
                cotizacion_ok: false,
                motivo: _motivoRestriccion(restricciones),
            },
        };
    }

    const { rows: conflictos } = await pool.query(
        `SELECT 1 FROM reservas r
          WHERE r.empresa_id::text = $1::text AND r.propiedad_id::text = $2::text
            AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
            AND r.fecha_llegada::date < $4::date AND r.fecha_salida::date > $3::date
          LIMIT 1`,
        [String(unidad.empresa_id), String(propiedadId), fechaInicio, fechaFin]
    );
    if (conflictos.length > 0) {
        return {
            http: 200,
            body: {
                ...base,
                cotizacion_ok: false,
                motivo: {
                    codigo: 'no_disponible_calendario',
                    mensaje_es: 'La propiedad no está disponible en esas fechas (reserva confirmada en traslape).',
                },
            },
        };
    }

    const { rows: canalRows } = await pool.query(
        `SELECT id, nombre FROM canales WHERE empresa_id::text = $1::text AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
        [String(unidad.empresa_id)]
    );
    if (!canalRows[0]) {
        return {
            http: 200,
            body: {
                ...base,
                cotizacion_ok: false,
                motivo: { codigo: 'no_canal', mensaje_es: 'No hay canal por defecto configurado.' },
            },
        };
    }
    const canalId = canalRows[0].id;

    const db = admin.firestore();
    const valorDolar = await obtenerValorDolar(db, unidad.empresa_id, inicio);
    const allTarifas = await obtenerTarifasParaConsumidores(unidad.empresa_id);
    const precioCalc = await calculatePrice(
        db,
        unidad.empresa_id,
        [{ id: propiedadId, nombre: propRows[0].nombre }],
        inicio,
        fin,
        allTarifas,
        canalId,
        valorDolar,
        false
    );

    const noches = precioCalc?.nights || Math.max(1, Math.round((fin - inicio) / 86400000));
    let valorTotal = Math.round(Number(precioCalc?.totalPriceCLP) || 0);
    let pricingFallback = null;
    if (!valorTotal) {
        const fallback = resolvePrecioNocheReferencia(
            { id: propRows[0].id, empresa_id: unidad.empresa_id, metadata: propRows[0].metadata || {} },
            allTarifas,
            new Map([[String(unidad.empresa_id), { id: canalId, moneda: 'CLP' }]])
        );
        const precioNoche = Math.round(Number(fallback.clp) || 0);
        if (precioNoche > 0 && noches > 0) {
            valorTotal = precioNoche * noches;
            pricingFallback = {
                activo: true,
                origen: fallback.origen || 'metadata.precioBase',
                precio_noche_referencia_clp: precioNoche,
                mensaje:
                    'No hubo tarifa completa en el rango; se cotiza con precio de referencia.',
            };
        } else {
            return {
                http: 200,
                body: {
                    ...base,
                    cotizacion_ok: false,
                    motivo: { codigo: 'no_pricing', mensaje_es: 'No hay tarifas configuradas para esta propiedad en esas fechas.' },
                },
            };
        }
    }
    const desglose = buildDesglosePrecioCheckout(valorTotal, legal, 'es', { noches, huespedes: personas });
    const extrasSum = (desglose.lineasExtraResueltas || []).reduce(
        (s, x) => s + (Math.round(Number(x.montoCLP) || 0) || 0),
        0
    );
    const lineasSrc = Array.isArray(desglose.lineas) ? desglose.lineas : [];
    const lineasPublicas = lineasSrc.map((ln) => ({
        etiqueta: ln.etiqueta,
        monto_clp: Math.round(Number(ln.montoCLP) || 0),
        es_extra: !!ln.esExtra,
    }));
    const seniaPagar = Math.round(valorTotal * 0.1);
    const avisoPol = buildAvisoPoliticaCancelacion(legal, 'es');

    return {
        http: 200,
        body: {
            ...base,
            cotizacion_ok: true,
            resumen_economico: {
                total_estadia_clp: valorTotal,
                senia_10pct_clp: seniaPagar,
                promedio_noche_clp: noches > 0 ? Math.round(valorTotal / noches) : null,
                moneda: 'CLP',
                noches,
            },
            desglose_checkout: desglose.mostrar
                ? {
                      modelo: desglose.modelo,
                      total_base_clp: valorTotal,
                      lineas: lineasPublicas,
                      extras_estimados_clp: extrasSum,
                      nota_pie: desglose.notaPie || null,
                      neto_clp: desglose.netoCLP != null ? Math.round(desglose.netoCLP) : null,
                      iva_clp: desglose.ivaCLP != null ? Math.round(desglose.ivaCLP) : null,
                  }
                : null,
            politica_cancelacion: {
                modo: legal.politicaCancelacionModo || null,
                horas_gratis: legal.politicaCancelacionHorasGratis ?? null,
                aviso: avisoPol.mostrar ? { texto: avisoPol.texto, variant: avisoPol.variant } : null,
            },
            ...(pricingFallback ? { pricing_fallback: pricingFallback } : {}),
            aviso:
                'Cotización informativa alineada a tarifas y desglose del checkout público. No incluye cupones. El POST /api/reservas confirma y persiste.',
        },
    };
}

module.exports = {
    cotizarReservaIaPublica,
};
