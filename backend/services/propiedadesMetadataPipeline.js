/**
 * Merge seguro de metadata de propiedad + geocoding Nominatim al guardar.
 * Evita perder claves anidadas (p. ej. googleHotelData.geo) al hacer PATCH parcial.
 */
const fetch = require('node-fetch');

const NESTED_MERGE_KEYS = new Set([
    'websiteData',
    'googleHotelData',
    'buildContext',
    'equipamiento',
    'camas',
    'sincronizacionIcal',
    'ubicacion',
]);

function isPlainObject(x) {
    return x != null && typeof x === 'object' && !Array.isArray(x) && x.constructor === Object;
}

function deepMergePropertyMetadata(prev = {}, patch = {}) {
    const out = { ...prev };
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (NESTED_MERGE_KEYS.has(k) && isPlainObject(v) && isPlainObject(prev[k])) {
            out[k] = { ...prev[k], ...v };
        } else {
            out[k] = v;
        }
    }
    return out;
}

function normalizeStringArray(arr, maxItems, maxLen) {
    if (!Array.isArray(arr)) return [];
    const lim = maxItems || 12;
    const seen = new Set();
    const out = [];
    for (const raw of arr) {
        const s = String(raw || '')
            .trim()
            .slice(0, maxLen || 160);
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
        if (out.length >= lim) break;
    }
    return out;
}

/**
 * @param {unknown} raw
 * @returns {{ tipo_viaje: string[], entorno: string[], destacados: string[] } | null}
 */
function sanitizeContextoComercial(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        tipo_viaje: normalizeStringArray(raw.tipo_viaje, 8, 48),
        entorno: normalizeStringArray(raw.entorno, 8, 48),
        destacados: normalizeStringArray(raw.destacados, 12, 200),
    };
}

function buildGeocodeQueryFromMeta(meta) {
    const parts = [];
    const u = meta.ubicacion || {};
    if (u.direccion) parts.push(String(u.direccion).trim());
    if (u.ciudad) parts.push(String(u.ciudad).trim());
    if (u.region) parts.push(String(u.region).trim());
    if (u.pais) parts.push(String(u.pais).trim());

    const wd = meta.websiteData || {};
    const a = wd.address || {};
    if (!parts.length && a.streetAddress) parts.push(String(a.streetAddress).trim());
    if (parts.length < 2 && a.addressLocality) parts.push(String(a.addressLocality).trim());
    if (parts.length < 2 && a.addressRegion) parts.push(String(a.addressRegion).trim());

    const gh = meta.googleHotelData || {};
    const ga = gh.address || {};
    if (!parts.length && ga.street) parts.push(String(ga.street).trim());
    if (parts.length < 2 && (ga.city || ga.locality)) parts.push(String(ga.city || ga.locality).trim());
    if (parts.length < 2 && (ga.region || ga.state)) parts.push(String(ga.region || ga.state).trim());

    const q = parts.filter(Boolean).join(', ');
    return q.length >= 4 ? q.slice(0, 280) : '';
}

/**
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number, display_name: string, ciudad: string, region: string, pais: string } | null>}
 */
async function nominatimSearchFirst(query) {
    const q = String(query || '').trim();
    if (q.length < 4) return null;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SuiteManager/1.0 (contact@suitemanager.cl)',
                'Accept-Language': 'es,en',
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            console.warn(`[propiedadesMetadataPipeline] Nominatim ${response.status}`);
            return null;
        }
        const results = await response.json();
        const r = results && results[0];
        if (!r) return null;
        return {
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            display_name: r.display_name || '',
            ciudad:
                r.address?.city ||
                r.address?.town ||
                r.address?.village ||
                r.address?.municipality ||
                r.address?.county ||
                '',
            region: r.address?.state || '',
            pais: r.address?.country || '',
        };
    } catch (e) {
        console.warn('[propiedadesMetadataPipeline] geocode:', e.message);
        return null;
    }
}

function snapshotUbicacionText(meta) {
    const q = buildGeocodeQueryFromMeta(meta);
    const u = meta.ubicacion || {};
    const lat = u.lat != null ? Number(u.lat) : null;
    const lng = u.lng != null ? Number(u.lng) : null;
    return { query: q, lat, lng };
}

/**
 * Escribe geo en googleHotelData y deja rastro opcional para no re-geocodificar sin cambio.
 * @param {object} meta — metadata ya mergeada con el PATCH
 * @param {object|null} prevMeta — metadata previa (solo para comparar query)
 */
async function applyGeocodeToMetadata(meta, prevMeta) {
    const gh = { ...(meta.googleHotelData || {}) };
    const geo = gh.geo && typeof gh.geo === 'object' ? gh.geo : {};
    const u = meta.ubicacion || {};
    const hasClientCoords =
        u.lat != null &&
        u.lng != null &&
        Number.isFinite(Number(u.lat)) &&
        Number.isFinite(Number(u.lng));

    if (hasClientCoords) {
        gh.geo = { lat: Number(u.lat), lng: Number(u.lng) };
        gh.latitude = Number(u.lat);
        gh.longitude = Number(u.lng);
        meta.googleHotelData = gh;
        meta.geocodificacion = {
            ...(meta.geocodificacion || {}),
            fuente: 'cliente_mapa',
            actualizado_at: new Date().toISOString(),
        };
        return meta;
    }

    const query = buildGeocodeQueryFromMeta(meta);
    const prevQ =
        prevMeta && prevMeta.geocodificacion && prevMeta.geocodificacion.query_ubicacion
            ? String(prevMeta.geocodificacion.query_ubicacion)
            : '';
    const hadGeo =
        geo.lat != null &&
        geo.lng != null &&
        Number.isFinite(Number(geo.lat)) &&
        Number.isFinite(Number(geo.lng));

    if (!query) {
        meta.googleHotelData = gh;
        return meta;
    }

    if (hadGeo && query === prevQ) {
        meta.googleHotelData = gh;
        return meta;
    }

    const hit = await nominatimSearchFirst(query);
    if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) {
        meta.googleHotelData = gh;
        return meta;
    }

    gh.geo = { lat: hit.lat, lng: hit.lng };
    gh.latitude = hit.lat;
    gh.longitude = hit.lng;
    gh.address = {
        ...(typeof gh.address === 'object' ? gh.address : {}),
        street: gh.address?.street || (meta.ubicacion && meta.ubicacion.direccion) || '',
        city: gh.address?.city || hit.ciudad || '',
        locality: gh.address?.locality || hit.ciudad || '',
        region: gh.address?.region || hit.region || '',
        state: gh.address?.state || hit.region || '',
        country: gh.address?.country || hit.pais || '',
    };

    meta.googleHotelData = gh;
    meta.geocodificacion = {
        ...(meta.geocodificacion || {}),
        fuente: 'nominatim',
        query_ubicacion: query,
        display_name: hit.display_name,
        actualizado_at: new Date().toISOString(),
    };
    return meta;
}

/**
 * @param {object} prevMetadata — JSON metadata actual en fila
 * @param {object} patch — resto del body (sin columnas SQL)
 */
async function finalizePropertyMetadataForSave(prevMetadata, patch) {
    const patchObj = patch && typeof patch === 'object' ? patch : {};
    let merged = deepMergePropertyMetadata(
        prevMetadata && typeof prevMetadata === 'object' ? prevMetadata : {},
        patchObj
    );

    if (Object.prototype.hasOwnProperty.call(patchObj, 'contextoComercial')) {
        const s = sanitizeContextoComercial(patchObj.contextoComercial);
        merged.contextoComercial = s || { tipo_viaje: [], entorno: [], destacados: [] };
    }

    const prevSnap = snapshotUbicacionText(prevMetadata || {});
    const nextSnap = snapshotUbicacionText(merged);
    const ubicacionCambio =
        nextSnap.query !== prevSnap.query ||
        (nextSnap.lat !== prevSnap.lat && (nextSnap.lat != null || prevSnap.lat != null));

    if (ubicacionCambio || !prevMetadata) {
        merged = await applyGeocodeToMetadata(merged, prevMetadata || {});
    }

    return merged;
}

module.exports = {
    deepMergePropertyMetadata,
    sanitizeContextoComercial,
    buildGeocodeQueryFromMeta,
    finalizePropertyMetadataForSave,
};
