/**
 * Payloads enriquecidos para venta por IA (ChatGPT / Actions): producto turístico vs solo inventario.
 * Reutiliza tarifas PG, normas (houseRulesService) y metadata ya usados en SSR.
 */
const pool = require('../db/postgres');
const { getPrecioBaseNoche, fetchTarifasForEmpresas } = require('../routes/website.shared');
const { mergeEffectiveRules, buildHouseRulesPublicView } = require('./houseRulesService');
const { contarDistribucion, getVerifiedInventory } = require('./propiedadLogicService');
const {
    enrichUbicacionForAi,
    enrichUbicacionFromEmpresaConfig,
    resolveGaleriaPrincipalIndex,
    deriveAmenidadesPublicas,
    buildInventarioDetallado,
    inferContextoTuristico,
    deriveSenalesRankingIa,
    buildDescripcionComercialAuto,
    mapEspacioToTipoIa,
} = require('./publicAiMarketingLayer');
const { obtenerPromedioResenasBatchPorPropiedades } = require('./resenasService');
const { buildAmenidadesEstructuradas } = require('./chatgptSalesAmenidadesModule');
const { buildDescripcionComercialIa } = require('./chatgptSalesDescriptionModule');
const { buildImagenesEtiquetadas } = require('./chatgptSalesImagesModule');
const { buildTarifasDetalladas } = require('./chatgptSalesTarifasModule');
const { buildPoliticasHorariosIa } = require('./chatgptSalesPoliciesModule');
const { buildGeoComercialIa } = require('./chatgptSalesGeoModule');

const DESC_MAX_LIST = 420;
const DESC_MAX_DETAIL = 8000;

function _stripHtml(s) {
    return String(s || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _clip(s, max) {
    const t = _stripHtml(s);
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

function _amenidadesLista(meta) {
    const amRaw = meta.amenidades;
    if (!Array.isArray(amRaw)) return [];
    return amRaw
        .map((a) => (typeof a === 'string' ? a : a?.nombre || ''))
        .filter(Boolean);
}

/** Precio mínimo por noche en cualquier canal con valor > 0 (fallback si no hay canal por defecto). */
function _minPrecioNocheCualquierCanal(propiedadId, allTarifas) {
    const prices = [];
    for (const t of allTarifas || []) {
        if (t.alojamientoId !== propiedadId) continue;
        Object.values(t.precios || {}).forEach((p) => {
            if (typeof p === 'number' && p > 0) prices.push(p);
        });
    }
    return prices.length ? Math.min(...prices) : 0;
}

function _amenidadesDesdeInventario(meta, maxExtra) {
    const inv = getVerifiedInventory(meta.componentes || []);
    const out = [];
    const seen = new Set();
    for (const it of inv) {
        const label = String(it.description || '').trim();
        if (!label || label.length > 80) continue;
        const k = label.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(`${it.quantity > 1 ? `${it.quantity}× ` : ''}${label}`);
        if (out.length >= maxExtra) break;
    }
    return out;
}

function _mergeAmenidades(meta, limite) {
    const base = _amenidadesLista(meta);
    const extra = _amenidadesDesdeInventario(meta, Math.max(8, limite - base.length));
    const merged = [];
    const seen = new Set();
    for (const x of [...base, ...extra]) {
        const k = String(x).toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        merged.push(x);
        if (merged.length >= limite) break;
    }
    return merged;
}

function _distribucion(meta) {
    const { numPiezas, numBanos } = contarDistribucion(meta.componentes || []);
    return { dormitorios: numPiezas, banos: numBanos };
}

function _ratingPublico(meta, resumenResenas) {
    const metaR = meta?.rating != null ? Number(meta.rating) : null;
    if (metaR != null && Number.isFinite(metaR)) return metaR;
    const pr = resumenResenas?.promedio_general != null ? Number(resumenResenas.promedio_general) : null;
    if (pr != null && Number.isFinite(pr)) return pr;
    return null;
}

function _ratingFuente(meta, resumenResenas) {
    const metaR = meta?.rating != null ? Number(meta.rating) : null;
    if (metaR != null && Number.isFinite(metaR)) return 'metadata.rating';
    const pr = resumenResenas?.promedio_general != null ? Number(resumenResenas.promedio_general) : null;
    if (pr != null && Number.isFinite(pr)) return 'resenas.promedio_general';
    return null;
}

/** Resumen estable bajo `precio` cuando existe cotización por estadía (complementa `precio_estimado`). */
function _precioPorEstadiaResumen(precioEstimado) {
    if (!precioEstimado || !precioEstimado.calculo_ok) return null;
    const dc = precioEstimado.desglose_checkout;
    const lineas = Array.isArray(dc?.lineas) ? dc.lineas : [];
    return {
        checkin: precioEstimado.checkin,
        checkout: precioEstimado.checkout,
        noches: precioEstimado.noches,
        moneda: precioEstimado.moneda,
        total_estadia_clp:
            precioEstimado.total_estadia_clp ?? precioEstimado.subtotal_alojamiento_clp ?? null,
        promedio_noche_clp: precioEstimado.promedio_noche_clp ?? null,
        extras_estimados_clp: dc?.extras_estimados_clp ?? null,
        lineas_extra_preview: lineas.length
            ? lineas.slice(0, 10).map((ln) => ({
                  etiqueta: ln.etiqueta,
                  monto_clp: ln.monto_clp,
                  es_extra: !!ln.es_extra,
              }))
            : null,
        modelo_checkout: dc?.modelo ?? null,
        iva_desglosado_clp: precioEstimado.referencia?.iva_desglosado_clp ?? null,
        neto_desglosado_clp: precioEstimado.referencia?.neto_desglosado_clp ?? null,
    };
}

/**
 * Precio de referencia para ordenar / listar: metadata → canal default → cualquier canal.
 */
function resolvePrecioNocheReferencia(row, allTarifas, defaultCanalByEmpresa) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const precioMeta = meta.precioBase != null ? Number(meta.precioBase) : null;
    if (precioMeta && precioMeta > 0) return { clp: precioMeta, origen: 'metadata.precioBase' };
    const empresaId = String(row.empresa_id);
    const canalInfo = defaultCanalByEmpresa?.get(empresaId);
    if (canalInfo?.id && allTarifas?.length) {
        const p = getPrecioBaseNoche(row.id, allTarifas, canalInfo.id);
        if (p > 0) return { clp: p, origen: 'tarifas.canal_por_defecto' };
    }
    const any = _minPrecioNocheCualquierCanal(row.id, allTarifas);
    if (any > 0) return { clp: any, origen: 'tarifas.min_cualquier_canal' };
    return { clp: 0, origen: null };
}

function _ubicacion(meta) {
    const gh = meta.googleHotelData || {};
    const addr = gh.address || {};
    const geo = gh.geo || meta.geo || {};
    const lat = geo.lat != null && Number.isFinite(Number(geo.lat)) ? Number(geo.lat) : null;
    const lng = geo.lng != null && Number.isFinite(Number(geo.lng)) ? Number(geo.lng) : null;
    const street = String(addr.street || '').trim();
    const city = String(addr.city || addr.locality || '').trim();
    const region = String(addr.region || addr.state || addr.administrativeArea || '').trim();
    return {
        direccion: street,
        ciudad: city,
        region,
        pais: String(addr.country || '').trim() || null,
        lat,
        lng,
        direccion_linea: [street, city, region].filter(Boolean).join(', ').slice(0, 200),
    };
}

function _fotoPrincipal(meta) {
    const wd = meta.websiteData || {};
    let fotoUrl = '';
    if (wd.cardImage?.storagePath) fotoUrl = String(wd.cardImage.storagePath).trim();
    if (!fotoUrl && wd.images && typeof wd.images === 'object') {
        const flat = Object.values(wd.images).flat().filter(Boolean);
        if (flat[0]?.storagePath) fotoUrl = String(flat[0].storagePath).trim();
    }
    return fotoUrl;
}

function _politicasPublicas(merged) {
    if (!merged) return null;
    const mascotas =
        merged.admiteMascotas === 'si' ? true : merged.admiteMascotas === 'no' ? false : null;
    const fumadores =
        merged.permiteFumar === 'si' ? true : merged.permiteFumar === 'no' ? false : null;
    return {
        mascotas,
        fumadores,
        mascotas_codigo: merged.admiteMascotas || null,
        fumar_codigo: merged.permiteFumar || null,
        hora_checkin: merged.horaEntrada || null,
        hora_checkout: merged.horaSalida || null,
    };
}

/**
 * Tarjeta de listado / búsqueda global para agentes.
 * @param {object} row — fila SQL con id, nombre, capacidad, descripcion, metadata, empresa_id, empresa_nombre; opcional empresa_configuracion (jsonb JOIN)
 * @param {object} ctx — incluye resenasPromedioByPropiedad: Map clave empresa_id\\0propiedad_id
 */
function buildListingCardForAi(row, ctx) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const empresaId = String(row.empresa_id);
    const canalInfo = ctx.defaultCanalByEmpresa?.get(empresaId);
    const { clp: precioNocheReferencia, origen: precioOrigen } = resolvePrecioNocheReferencia(
        row,
        ctx.allTarifas,
        ctx.defaultCanalByEmpresa
    );
    const moneda = canalInfo?.moneda || 'CLP';
    const empRules = ctx.houseRulesByEmpresa?.get(empresaId) || null;
    const merged = mergeEffectiveRules(empRules, meta.normasAlojamiento || {});
    let ubic = _ubicacion(meta);
    if (!ubic.ciudad && !ubic.direccion && meta.ciudad) {
        ubic = { ...ubic, ciudad: String(meta.ciudad).trim() };
    }
    if (!ubic.direccion && meta.direccion) {
        ubic = { ...ubic, direccion: String(meta.direccion).trim() };
    }
    if (!ubic.direccion_linea) {
        ubic = {
            ...ubic,
            direccion_linea: [ubic.direccion, ubic.ciudad, ubic.region].filter(Boolean).join(', ').slice(0, 200),
        };
    }
    ubic = enrichUbicacionForAi(meta, ubic);
    const empCfgFull =
        row.empresa_configuracion && typeof row.empresa_configuracion === 'object'
            ? row.empresa_configuracion
            : ctx.empresaConfigByEmpresaId?.get(empresaId);
    if (empCfgFull) {
        ubic = enrichUbicacionFromEmpresaConfig(ubic, empCfgFull);
    }
    const amLim = ctx.compact ? 14 : 32;
    const amenidades = _mergeAmenidades(meta, amLim);
    const inventarioMax = ctx.compact ? 10 : 25;
    const inventario_detallado = buildInventarioDetallado(meta, inventarioMax);
    const amenidades_publicas = deriveAmenidadesPublicas(amenidades, row.nombre);
    const distribucion = _distribucion(meta);
    const amenidades_estructuradas = buildAmenidadesEstructuradas({
        row,
        meta,
        amenidades,
        amenidadesPublicas: amenidades_publicas,
        inventarioDetallado: inventario_detallado,
        distribucion,
        mergedRules: merged,
    });
    const contexto_turistico = inferContextoTuristico(meta, row, distribucion, amenidades_publicas);
    const resKey = `${empresaId}\0${String(row.id)}`;
    const resSnap = ctx.resenasPromedioByPropiedad?.get(resKey);
    const resumenParaRating = resSnap
        ? { total: resSnap.total, promedio_general: resSnap.promedio_general }
        : null;
    const senales_ranking_ia = deriveSenalesRankingIa({
        capacidad: row.capacidad,
        contexto_turistico,
        amenidades_publicas,
        resumenResenas: resumenParaRating || { total: 0, promedio_general: null },
    });
    const descSource =
        (typeof row.descripcion === 'string' && row.descripcion.trim()) ||
        meta.websiteData?.description ||
        meta.websiteData?.shortDescription ||
        '';
    const descMax = ctx.compact ? 380 : DESC_MAX_LIST;
    let descripcion = _clip(descSource, descMax) || null;
    let descripcion_fuente = descripcion ? 'meta_o_columna' : null;
    if (!descripcion) {
        descripcion = buildDescripcionComercialAuto({
            nombre: row.nombre,
            capacidad: row.capacidad,
            distribucion,
            amenidades_publicas,
            empresaNombre: row.empresa_nombre,
        });
        descripcion_fuente = 'auto_template';
    }
    const descripcion_comercial = buildDescripcionComercialIa({
        row,
        meta,
        descripcionBase: descripcion,
        contextoTuristico: contexto_turistico,
        amenidadesEstructuradas: amenidades_estructuradas,
    });
    const rulesView = buildHouseRulesPublicView(merged, Number(row.capacidad) || 0);
    const resumenNormas = [rulesView.sumLine1, rulesView.sumLine2, rulesView.sumLine3]
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ');
    const ratingVal = _ratingPublico(meta, resumenParaRating);
    const rating_fuente = _ratingFuente(meta, resumenParaRating);
    const nocheInt = precioNocheReferencia > 0 ? Math.round(precioNocheReferencia) : null;

    return {
        id: row.id,
        nombre: row.nombre,
        capacidad: Number(row.capacidad) || 0,
        empresa: {
            id: empresaId,
            nombre: row.empresa_nombre || 'Empresa',
        },
        precio: {
            noche_referencia_clp: nocheInt,
            moneda,
            origen: precioOrigen,
        },
        ubicacion: ubic,
        descripcion,
        descripcion_comercial,
        descripcion_fuente,
        amenidades,
        amenidades_estructuradas,
        amenidades_publicas,
        inventario_detallado,
        contexto_turistico,
        distribucion,
        politicas: _politicasPublicas(merged),
        resumen_normas: resumenNormas || null,
        foto_url: _fotoPrincipal(meta) || null,
        rating: ratingVal,
        rating_fuente: rating_fuente || null,
        senales_ranking_ia,
        listada_web: !!(meta.googleHotelData && meta.googleHotelData.isListed),
        payload_version: 'producto_ia_v2',
        precioBase: nocheInt,
        ciudad: ubic.ciudad || '',
        direccion_corta: ubic.direccion_linea || '',
    };
}

/**
 * Carga houseRules por empresa (jsonb) para un conjunto de IDs.
 * @param {string[]} empresaIds
 */
async function fetchHouseRulesByEmpresaIds(empresaIds) {
    const ids = [...new Set((empresaIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!ids.length || !pool) return new Map();
    const { rows } = await pool.query(
        `SELECT id,
                configuracion->'websiteSettings'->'houseRules' AS house_rules
           FROM empresas
          WHERE id::text = ANY($1::text[])`,
        [ids]
    );
    const m = new Map();
    rows.forEach((r) => {
        const hr = r.house_rules && typeof r.house_rules === 'object' ? r.house_rules : null;
        m.set(String(r.id), hr);
    });
    return m;
}

/**
 * Mapa empresa_id → configuración (jsonb) deduplicado desde filas con JOIN a empresas.
 * @param {object[]} rows
 */
function _empresaConfigMapFromRows(rows) {
    const m = new Map();
    for (const r of rows || []) {
        const id = String(r.empresa_id || '').trim();
        if (!id || m.has(id)) continue;
        const cfg = r.empresa_configuracion;
        if (cfg && typeof cfg === 'object') m.set(id, cfg);
    }
    return m;
}

/**
 * Enriquece filas de propiedades (listados IA) con precio tarifario, normas y textos recortados.
 * @param {object[]} rows — pueden incluir `empresa_configuracion` por JOIN (recomendado para ubicación empresa)
 * @param {{ compact?: boolean }} options
 */
async function enrichPropertyRowsForPublicAi(rows, options = {}) {
    if (!pool || !rows.length) return [];
    const empIds = rows.map((r) => r.empresa_id);
    const compact = !!options.compact;
    const empresaConfigByEmpresaId = _empresaConfigMapFromRows(rows);
    const [{ allTarifas, defaultCanalByEmpresa }, houseRulesByEmpresa, resenasPromedioByPropiedad] =
        await Promise.all([
            fetchTarifasForEmpresas(empIds),
            fetchHouseRulesByEmpresaIds(empIds),
            obtenerPromedioResenasBatchPorPropiedades(
                rows.map((r) => ({ empresa_id: r.empresa_id, propiedad_id: r.id }))
            ),
        ]);
    const ctx = {
        allTarifas,
        defaultCanalByEmpresa,
        houseRulesByEmpresa,
        empresaConfigByEmpresaId,
        resenasPromedioByPropiedad,
        compact,
    };
    return rows.map((row) => buildListingCardForAi(row, ctx));
}

/**
 * Flujo sugerido para agentes cuando el detalle viene de PostgreSQL (`GET /api/alojamientos/detalle`).
 * @param {{ empresaId: string, alojamientoId: string }} p
 */
function buildBookingWorkflowForIaDetallePg({ empresaId, alojamientoId }) {
    const eid = String(empresaId || '').trim();
    const aid = String(alojamientoId || '').trim();
    return {
        paso_1: `GET /api/disponibilidad?empresa_id=${eid}&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD (opcional: adultos). En alojamientos[] localizar id=${aid} para disponible, precio_total_estadia_clp y motivo_no_disponible.`,
        paso_resolve: `POST /api/reservas/resolve-booking-unit o POST /api/public/reservas/resolve-booking-unit para traducir catalog_id -> booking_id estable.`,
        paso_resolve_body: {
            empresa_id: eid,
            catalog_id: aid,
            checkin: 'YYYY-MM-DD',
            checkout: 'YYYY-MM-DD',
            personas: 2,
        },
        paso_2: `GET /api/alojamientos/detalle?alojamiento_id=${aid}&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD (opcional adultos) — ficha + precio_estimado por estadía.`,
        paso_2b: `POST /api/reservas/cotizar o POST /api/public/reservas/cotizar (dry-run: desglose checkout + política cancelación; no persiste; en /api/public mismos headers/límite que POST /api/public/reservas).`,
        paso_2b_body: {
            empresa_id: eid,
            alojamiento_id: aid,
            checkin: 'YYYY-MM-DD',
            checkout: 'YYYY-MM-DD',
            adultos: 2,
            ninos: 0,
            origen: 'chatgpt',
            huesped: {
                nombre: 'string (opcional en cotización)',
                apellido: 'string (opcional)',
                email: 'string (opcional)',
                telefono: 'string (opcional)',
            },
        },
        paso_3: `POST /api/reservas o POST /api/public/reservas`,
        paso_3_body: {
            empresa_id: eid,
            booking_id: aid,
            alojamiento_id: aid,
            checkin: 'YYYY-MM-DD',
            checkout: 'YYYY-MM-DD',
            adultos: 2,
            ninos: 0,
            origen: 'chatgpt',
            huesped: {
                nombre: 'string',
                apellido: 'string',
                email: 'string',
                telefono: 'string (opcional)',
            },
        },
    };
}

/**
 * Detalle “producto” para Actions (OpenAPI /api/alojamientos/detalle).
 */
function buildAgentPropertyDetailPayload({
    row,
    galeriaRows,
    resumenResenas,
    precioNocheReferencia,
    moneda,
    mergedRules,
    precioOrigen,
    precio_estimado = null,
    empresaConfig = null,
    aviso_precio_estimado = null,
}) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    let ubic = _ubicacion(meta);
    if (!ubic.ciudad && meta.ciudad) ubic = { ...ubic, ciudad: String(meta.ciudad).trim() };
    if (!ubic.direccion && meta.direccion) ubic = { ...ubic, direccion: String(meta.direccion).trim() };
    if (!ubic.direccion_linea) {
        ubic = {
            ...ubic,
            direccion_linea: [ubic.direccion, ubic.ciudad, ubic.region].filter(Boolean).join(', ').slice(0, 200),
        };
    }
    ubic = enrichUbicacionForAi(meta, ubic);
    if (empresaConfig && typeof empresaConfig === 'object') {
        ubic = enrichUbicacionFromEmpresaConfig(ubic, empresaConfig);
    }
    const amenidades = _mergeAmenidades(meta, 48);
    const inventario_detallado = buildInventarioDetallado(meta, 60);
    const amenidades_publicas = deriveAmenidadesPublicas(amenidades, row.nombre);
    const distribucion = _distribucion(meta);
    const amenidades_estructuradas = buildAmenidadesEstructuradas({
        row,
        meta,
        amenidades,
        amenidadesPublicas: amenidades_publicas,
        inventarioDetallado: inventario_detallado,
        distribucion,
        mergedRules,
    });
    const contexto_turistico = inferContextoTuristico(meta, row, distribucion, amenidades_publicas);
    let desc = _clip(row.descripcion || meta.websiteData?.description || '', DESC_MAX_DETAIL);
    let descripcion_fuente = desc ? 'meta_o_columna' : null;
    if (!desc) {
        desc = buildDescripcionComercialAuto({
            nombre: row.nombre,
            capacidad: row.capacidad,
            distribucion,
            amenidades_publicas,
            empresaNombre: row.empresa_nombre,
        });
        descripcion_fuente = 'auto_template';
    }
    const rulesView = buildHouseRulesPublicView(mergedRules, Number(row.capacidad) || 0);
    const principalIdx = resolveGaleriaPrincipalIndex(galeriaRows, meta);
    const imagenes = (galeriaRows || []).map((r, idx) => {
        const espacioLabel = (r.espacio && String(r.espacio).trim()) || '';
        const rol = r.rol || 'adicional';
        const alt = r.alt_text || '';
        return {
            url: r.storage_url,
            thumbnail_url: r.thumbnail_url || null,
            alt,
            tipo: rol,
            espacio: espacioLabel || null,
            tipo_ia: mapEspacioToTipoIa(espacioLabel, rol, alt),
            orden: r.orden != null ? Number(r.orden) : idx + 1,
            principal: principalIdx >= 0 && idx === principalIdx,
        };
    });
    const imagenes_etiquetadas = buildImagenesEtiquetadas(imagenes);
    const inventario = getVerifiedInventory(meta.componentes || []).slice(0, 60);
    const nocheInt = precioNocheReferencia > 0 ? Math.round(precioNocheReferencia) : null;
    const ratingVal = _ratingPublico(meta, resumenResenas);
    const rating_fuente = _ratingFuente(meta, resumenResenas);
    const senales_ranking_ia = deriveSenalesRankingIa({
        capacidad: row.capacidad,
        contexto_turistico,
        amenidades_publicas,
        resumenResenas: resumenResenas || { total: 0, promedio_general: null },
    });
    const resumenPrecioEstadia = _precioPorEstadiaResumen(precio_estimado);
    const descripcion_comercial = buildDescripcionComercialIa({
        row,
        meta,
        descripcionBase: desc,
        contextoTuristico: contexto_turistico,
        amenidadesEstructuradas: amenidades_estructuradas,
    });
    const geo_comercial = buildGeoComercialIa({ ubicacion: ubic, meta });
    const tarifas_detalladas = buildTarifasDetalladas({
        precio: {
            noche_referencia_clp: nocheInt,
            moneda: moneda || 'CLP',
            ...(resumenPrecioEstadia ? { por_estadia: resumenPrecioEstadia } : {}),
        },
        precioEstimado: precio_estimado,
    });
    const politicas_horarios = buildPoliticasHorariosIa({
        politicas: _politicasPublicas(mergedRules),
        precioEstimado: precio_estimado,
    });

    return {
        success: true,
        id: row.id,
        nombre: row.nombre,
        capacidad: Number(row.capacidad) || 0,
        descripcion: desc,
        descripcion_comercial,
        descripcion_fuente,
        empresa: { id: String(row.empresa_id), nombre: row.empresa_nombre || '' },
        precio: {
            noche_referencia_clp: nocheInt,
            moneda: moneda || 'CLP',
            origen: precioOrigen || null,
            ...(resumenPrecioEstadia ? { por_estadia: resumenPrecioEstadia } : {}),
        },
        ubicacion: ubic,
        amenidades,
        amenidades_estructuradas,
        amenidades_publicas,
        inventario_detallado,
        distribucion,
        inventario_verificado: inventario,
        contexto_turistico,
        senales_ranking_ia,
        politicas: _politicasPublicas(mergedRules),
        politicas_horarios,
        normas: {
            resumen_lineas: [rulesView.sumLine1, rulesView.sumLine2, rulesView.sumLine3].filter(Boolean),
            secciones: rulesView.secciones || [],
        },
        imagenes,
        imagenes_etiquetadas,
        resenas: resumenResenas || { total: 0, promedio_general: null },
        listada_web: !!(meta.googleHotelData && meta.googleHotelData.isListed),
        payload_version: 'producto_ia_v2',
        requiere_confirmacion_final: true,
        precioBase: nocheInt,
        ciudad: ubic.ciudad || '',
        direccion_corta: ubic.direccion_linea || '',
        rating: ratingVal,
        rating_fuente: rating_fuente || null,
        ...(precio_estimado != null ? { precio_estimado } : {}),
        ...(aviso_precio_estimado != null ? { aviso_precio_estimado } : {}),
        geo_comercial,
        tarifas_detalladas,
        booking_workflow: buildBookingWorkflowForIaDetallePg({
            empresaId: row.empresa_id,
            alojamientoId: row.id,
        }),
    };
}

module.exports = {
    buildListingCardForAi,
    enrichPropertyRowsForPublicAi,
    fetchHouseRulesByEmpresaIds,
    buildAgentPropertyDetailPayload,
    resolvePrecioNocheReferencia,
    _clip,
};
