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
    buildDescripcionComercialAuto,
    mapEspacioToTipoIa,
} = require('./publicAiMarketingLayer');

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
 * @param {object} ctx — { allTarifas, defaultCanalByEmpresa: Map, houseRulesByEmpresa: Map, empresaConfigByEmpresaId?: Map, compact?: boolean }
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
    const contexto_turistico = inferContextoTuristico(meta, row, distribucion, amenidades_publicas);
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
    const rulesView = buildHouseRulesPublicView(merged, Number(row.capacidad) || 0);
    const resumenNormas = [rulesView.sumLine1, rulesView.sumLine2, rulesView.sumLine3]
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ');
    const ratingVal = meta.rating != null ? Number(meta.rating) : null;
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
        descripcion_fuente,
        amenidades,
        amenidades_publicas,
        inventario_detallado,
        contexto_turistico,
        distribucion,
        politicas: _politicasPublicas(merged),
        resumen_normas: resumenNormas || null,
        foto_url: _fotoPrincipal(meta) || null,
        rating: ratingVal,
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
    const [{ allTarifas, defaultCanalByEmpresa }, houseRulesByEmpresa] = await Promise.all([
        fetchTarifasForEmpresas(empIds),
        fetchHouseRulesByEmpresaIds(empIds),
    ]);
    const ctx = {
        allTarifas,
        defaultCanalByEmpresa,
        houseRulesByEmpresa,
        empresaConfigByEmpresaId,
        compact,
    };
    return rows.map((row) => buildListingCardForAi(row, ctx));
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
    const inventario = getVerifiedInventory(meta.componentes || []).slice(0, 60);
    const nocheInt = precioNocheReferencia > 0 ? Math.round(precioNocheReferencia) : null;
    const ratingVal = meta.rating != null ? Number(meta.rating) : null;

    return {
        success: true,
        id: row.id,
        nombre: row.nombre,
        capacidad: Number(row.capacidad) || 0,
        descripcion: desc,
        descripcion_fuente,
        empresa: { id: String(row.empresa_id), nombre: row.empresa_nombre || '' },
        precio: {
            noche_referencia_clp: nocheInt,
            moneda: moneda || 'CLP',
            origen: precioOrigen || null,
        },
        ubicacion: ubic,
        amenidades,
        amenidades_publicas,
        inventario_detallado,
        distribucion,
        inventario_verificado: inventario,
        contexto_turistico,
        politicas: _politicasPublicas(mergedRules),
        normas: {
            resumen_lineas: [rulesView.sumLine1, rulesView.sumLine2, rulesView.sumLine3].filter(Boolean),
            secciones: rulesView.secciones || [],
        },
        imagenes,
        resenas: resumenResenas || { total: 0, promedio_general: null },
        listada_web: !!(meta.googleHotelData && meta.googleHotelData.isListed),
        payload_version: 'producto_ia_v2',
        precioBase: nocheInt,
        ciudad: ubic.ciudad || '',
        direccion_corta: ubic.direccion_linea || '',
        rating: ratingVal,
        ...(precio_estimado != null ? { precio_estimado } : {}),
        ...(aviso_precio_estimado != null ? { aviso_precio_estimado } : {}),
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
