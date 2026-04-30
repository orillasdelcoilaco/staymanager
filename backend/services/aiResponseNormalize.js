/**
 * Normaliza respuestas de modelos de IA cuando el contrato pide ids/claves exactos
 * y el modelo devuelve alias, envoltorios o tipos mezclados (string vs UUID).
 */

/**
 * @param {object|null|undefined} obj
 * @param {string[]} keys - orden de preferencia
 * @returns {string} primer string no vacío o ''
 */
function pickFirstString(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of keys) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        const v = obj[k];
        if (v === null || v === undefined || v === false || v === 0) continue;
        if (typeof v === 'object') continue;
        const s = String(v).trim();
        if (s.length > 0) return s;
    }
    return '';
}

/**
 * Busca entidad con id en lista (comparación por String).
 * @param {Array<{id?:string}>} list
 * @param {string} id
 * @returns {object|undefined}
 */
function findEntityByIdLoose(list, id) {
    const sid = String(id ?? '').trim();
    if (!sid || !Array.isArray(list)) return undefined;
    return list.find((e) => e && String(e.id ?? '').trim() === sid);
}

/**
 * Desenvuelve resultado SEO/JSON-LD si la IA anidó el payload.
 * @param {object|null} raw
 * @returns {object|null}
 */
function unwrapSeoJsonLdResult(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.jsonLd != null && typeof raw.jsonLd === 'object') {
        return raw;
    }
    const nestKeys = ['result', 'seo', 'data', 'output', 'response', 'payload', 'publicacion'];
    for (const nk of nestKeys) {
        const inner = raw[nk];
        if (inner && typeof inner === 'object' && inner.jsonLd != null && typeof inner.jsonLd === 'object') {
            return {
                metaTitle: inner.metaTitle ?? raw.metaTitle ?? '',
                metaDescription: inner.metaDescription ?? raw.metaDescription ?? '',
                keywords: inner.keywords ?? raw.keywords,
                jsonLd: inner.jsonLd,
            };
        }
    }
    const direct = raw.jsonLdSchema ?? raw.structuredData ?? raw.schema;
    if (direct && typeof direct === 'object') {
        return {
            metaTitle: raw.metaTitle || '',
            metaDescription: raw.metaDescription || '',
            keywords: raw.keywords,
            jsonLd: direct,
        };
    }
    if (raw['@context'] || raw['@type']) {
        return {
            metaTitle: raw.metaTitle || '',
            metaDescription: raw.metaDescription || '',
            keywords: raw.keywords,
            jsonLd: raw,
        };
    }
    return raw;
}

/**
 * Une un nivel de envoltorio típico del modelo (data/result/narrativa/…).
 * @param {object|null} raw
 * @returns {object|null}
 */
function flattenNarrativaAiPayload(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const nestKeys = ['narrativa', 'content', 'payload', 'data', 'result', 'output', 'response'];
    let merged = { ...raw };
    for (const nk of nestKeys) {
        const inner = raw[nk];
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            merged = { ...merged, ...inner };
        }
    }
    return merged;
}

/**
 * Texto principal de narrativa comercial desde respuesta IA (claves alias + envoltorios).
 * @param {object|null|undefined} raw
 * @returns {string}
 */
function extractDescripcionComercialNarrativa(raw) {
    const flat = flattenNarrativaAiPayload(raw);
    if (!flat || typeof flat !== 'object') return '';
    let s = pickFirstString(flat, [
        'descripcionComercial',
        'descripcion',
        'texto',
        'copy',
        'body',
        'contenido',
        'descripcion_comercial',
    ]);
    if (!s && typeof flat.text === 'string') s = flat.text.trim();
    return String(s || '').trim();
}

module.exports = {
    pickFirstString,
    findEntityByIdLoose,
    unwrapSeoJsonLdResult,
    flattenNarrativaAiPayload,
    extractDescripcionComercialNarrativa,
};
