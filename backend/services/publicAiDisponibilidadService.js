/**
 * Respuesta enriquecida de disponibilidad para Actions / IA: restricciones de fechas, fotos reales,
 * precio total por estadía cuando hay tarifas, motivo si no aplica la consulta o no hay cupo.
 */
const admin = require('firebase-admin');
const pool = require('../db/postgres');
const { differenceInDays } = require('date-fns');
const { getAvailabilityData, calculatePrice } = require('./publicWebsiteService');
const { fetchTarifasYCanal } = require('../routes/website.shared');
const { evaluarRestriccionesReservaWebCodigo } = require('./reservaWebRestriccionesService');
const { resolvePrecioNocheReferencia } = require('./publicAiProductSnapshot');

function _fotoCardDesdeProp(p) {
    const wd = p.websiteData || {};
    if (wd.cardImage?.storagePath) return String(wd.cardImage.storagePath).trim();
    if (wd.images && typeof wd.images === 'object') {
        const flat = Object.values(wd.images).flat().filter(Boolean);
        if (flat[0]?.storagePath) return String(flat[0].storagePath).trim();
    }
    return '';
}

function _nombreComercial(p) {
    const wd = p.websiteData || {};
    return (
        String(wd.nombreComercial || wd.title || '').trim() ||
        String(p.buildContext?.title || '').trim() ||
        null
    );
}

function _heuristicaDemoEmpresa(nombreEmpresa, subdominio) {
    const n = String(nombreEmpresa || '');
    const s = String(subdominio || '');
    if (/\b(prueba|demo|test|staging|sandbox)\b/i.test(n)) return true;
    if (/^(prueba|demo|test)/i.test(s)) return true;
    return false;
}

async function _fetchGaleriaPreviewPorPropiedades(empresaId, propiedadIds, maxPorProp) {
    const ids = [...new Set((propiedadIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const map = new Map();
    if (!pool || !ids.length) return map;
    const lim = Math.min(Math.max(maxPorProp || 4, 1), 8);
    const { rows } = await pool.query(
        `SELECT propiedad_id::text AS propiedad_id, storage_url, thumbnail_url, alt_text, rol, orden
           FROM galeria
          WHERE empresa_id::text = $1::text
            AND propiedad_id::text = ANY($2::text[])
            AND estado IN ('auto', 'manual')
          ORDER BY propiedad_id::text, (rol = 'principal') DESC, orden ASC NULLS LAST, id ASC`,
        [String(empresaId), ids]
    );
    for (const r of rows) {
        const pid = String(r.propiedad_id);
        if (!map.has(pid)) map.set(pid, []);
        const arr = map.get(pid);
        if (arr.length >= lim) continue;
        arr.push({
            url: r.storage_url,
            thumbnail_url: r.thumbnail_url || null,
            alt: r.alt_text || '',
        });
    }
    return map;
}

/**
 * @param {object} opts
 * @param {string} opts.empresaIdRaw
 * @param {string} opts.empresaId — UUID resuelto
 * @param {string} opts.checkin
 * @param {string} opts.checkout
 * @param {number} opts.personas
 * @param {Date} opts.inicio
 * @param {Date} opts.fin
 */
async function buildDisponibilidadAgentResponse(opts) {
    const { empresaIdRaw, empresaId, checkin, checkout, personas, inicio, fin } = opts;
    const db = admin.firestore();

    const { rows: empRows } = await pool.query(
        `SELECT id, nombre, configuracion, subdominio, dominio
           FROM empresas
          WHERE id::text = $1::text
          LIMIT 1`,
        [String(empresaId)]
    );
    const emp = empRows[0] || {};
    const cfg = emp.configuracion && typeof emp.configuracion === 'object' ? emp.configuracion : {};
    const ws = cfg.websiteSettings && typeof cfg.websiteSettings === 'object' ? cfg.websiteSettings : {};
    const bookingCfg = ws.booking || {};
    const nombreEmpresa = String(emp.nombre || '').trim();

    const { rows: propRows } = await pool.query(
        `SELECT id, nombre, capacidad, metadata
           FROM propiedades
          WHERE empresa_id::text = $1::text AND activo = true`,
        [String(empresaId)]
    );
    const propsData = propRows.map((r) => {
        const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
        return { websiteData: { booking: meta.websiteData?.booking } };
    });

    const restricciones = evaluarRestriccionesReservaWebCodigo(bookingCfg, propsData, checkin, checkout);
    const motivoConsulta = restricciones.ok
        ? null
        : {
              codigo: restricciones.codigo,
              noches_solicitadas: restricciones.noches_solicitadas,
              minimo_noches: restricciones.minimo_noches,
              maximo_noches: restricciones.maximo_noches,
              meses_reservable_adelante: restricciones.meses_reservable_adelante,
              anticipacion_dias_necesarios: restricciones.anticipacion_dias_necesarios,
              dias_hasta_llegada: restricciones.dias_hasta_llegada,
              mensaje_es: restricciones.mensaje_es,
          };
    const baseMeta = {
        success: true,
        empresa_id: empresaIdRaw,
        empresa: {
            id: String(empresaId),
            nombre: nombreEmpresa,
            nombre_corto: nombreEmpresa,
            is_demo_heuristica: _heuristicaDemoEmpresa(nombreEmpresa, emp.subdominio),
            subdominio: emp.subdominio || null,
            dominio: emp.dominio || null,
        },
        checkin,
        checkout,
        personas,
        consulta_valida: restricciones.ok,
        motivo_consulta: motivoConsulta,
        reglas_estadia: restricciones.ok ? restricciones.reglas_resumen : null,
        requiere_confirmacion_reserva: true,
        endpoints: {
            galeria: 'GET /api/alojamientos/imagenes?alojamiento_id={id}',
            detalle: 'GET /api/alojamientos/detalle?alojamiento_id={id}&checkin=&checkout=',
            cotizar_reserva_dry_run: 'POST /api/reservas/cotizar (o /api/public/reservas/cotizar; mismo cuerpo que crear reserva; ver booking_workflow en respuesta de detalle)',
        },
        payload_version: 'disponibilidad_ia_v1',
    };

    if (!restricciones.ok) {
        return {
            ...baseMeta,
            total: propRows.length,
            disponibles: 0,
            alojamientos: [],
        };
    }

    const { availableProperties, unavailableProperties } = await getAvailabilityData(
        db,
        empresaId,
        inicio,
        fin,
        false,
        null
    );

    const { allTarifas, canalPorDefectoId, canalMoneda } = await fetchTarifasYCanal(empresaId);
    const noches = differenceInDays(fin, inicio);

    let disponibles = availableProperties || [];
    if (personas > 0) disponibles = disponibles.filter((p) => (p.capacidad || 0) >= personas);

    const slicePrecio = disponibles.slice(0, 15);
    const precioById = new Map();
    await Promise.all(
        slicePrecio.map(async (p) => {
            try {
                const data = await calculatePrice(
                    db,
                    empresaId,
                    [{ id: p.id, nombre: p.nombre }],
                    inicio,
                    fin,
                    allTarifas
                );
                precioById.set(String(p.id), {
                    total_clp: Math.round(Number(data.totalPriceCLP) || 0),
                    noches: data.nights || noches,
                });
            } catch {
                precioById.set(String(p.id), { total_clp: null, noches: noches });
            }
        })
    );

    const conTarifaIds = new Set([
        ...disponibles.map((p) => String(p.id)),
        ...(unavailableProperties || []).map((p) => String(p.id)),
    ]);
    const sinTarifaRows = propRows.filter((r) => !conTarifaIds.has(String(r.id)));

    const todosIds = [
        ...disponibles.map((p) => p.id),
        ...(unavailableProperties || []).map((p) => p.id),
        ...sinTarifaRows.slice(0, 40).map((r) => r.id),
    ];
    const galeriaMap = await _fetchGaleriaPreviewPorPropiedades(empresaId, todosIds, 5);

    const mapAloj = (p, disponible) => {
        const pid = String(p.id);
        const px = precioById.get(pid);
        const fotos = galeriaMap.get(pid) || [];
        const fotoUrl = fotos[0]?.url || _fotoCardDesdeProp(p);
        const out = {
            id: pid,
            nombre: p.nombre,
            nombre_comercial: _nombreComercial(p),
            disponible,
            capacidad: p.capacidad || 0,
            foto_url: fotoUrl || null,
            fotos_preview: fotos.length ? fotos : null,
            precio_total_estadia_clp: disponible ? px?.total_clp ?? null : null,
            moneda: canalMoneda || 'CLP',
            noches: px?.noches ?? noches,
        };
        if (!disponible) {
            out.motivo_no_disponible = {
                codigo: 'ocupado_o_bloqueado',
                mensaje:
                    'Hay traslape con reserva confirmada/propuesta o bloqueo de calendario en las fechas pedidas.',
            };
        }
        return out;
    };

    const defaultCanalByEmpresa = new Map();
    if (canalPorDefectoId) {
        defaultCanalByEmpresa.set(String(empresaId), { id: canalPorDefectoId, moneda: canalMoneda || 'CLP' });
    }
    const sinTarifaListados = sinTarifaRows.map((r) => {
        const meta = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
        const p = { id: r.id, nombre: r.nombre, capacidad: r.capacidad, ...meta, websiteData: meta.websiteData };
        const pid = String(r.id);
        const fotos = galeriaMap.get(pid) || [];
        const fotoUrl = fotos[0]?.url || _fotoCardDesdeProp(p);
        const fallback = resolvePrecioNocheReferencia(
            { id: r.id, empresa_id: empresaId, metadata: meta },
            allTarifas,
            defaultCanalByEmpresa
        );
        const fallbackNoche = Math.round(Number(fallback.clp) || 0);
        const fallbackTotal = fallbackNoche > 0 ? fallbackNoche * Math.max(1, noches) : null;
        const disponibleFallback = fallbackTotal != null;
        return {
            id: pid,
            nombre: r.nombre,
            nombre_comercial: _nombreComercial(p),
            disponible: disponibleFallback,
            capacidad: r.capacidad || 0,
            foto_url: fotoUrl || null,
            fotos_preview: fotos.length ? fotos : null,
            precio_total_estadia_clp: fallbackTotal,
            moneda: canalMoneda || 'CLP',
            noches,
            ...(disponibleFallback
                ? {
                      pricing_fallback: {
                          activo: true,
                          origen: fallback.origen,
                          precio_noche_referencia_clp: fallbackNoche,
                          mensaje:
                              'Se usa precio de referencia (metadata/tarifa mínima) por falta de tarifa completa en el rango.',
                      },
                  }
                : {
                      motivo_no_disponible: {
                          codigo: 'sin_tarifa_en_fechas',
                          mensaje:
                              'No hay tarifa publicada que cubra todas las noches de esta estadía (revisar temporadas o canal por defecto).',
                      },
                  }),
        };
    });

    const listados = [
        ...disponibles.map((p) => mapAloj(p, true)),
        ...(unavailableProperties || []).map((p) => mapAloj(p, false)),
        ...sinTarifaListados,
    ];

    return {
        ...baseMeta,
        total: listados.length,
        disponibles: disponibles.length,
        alojamientos: listados,
        canal_tarifas_configurado: !!canalPorDefectoId,
    };
}

module.exports = {
    buildDisponibilidadAgentResponse,
};
