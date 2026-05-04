/**
 * Feed global único para Google Hotels Connectivity Partner (TASKS/venta-ia.md §7.9–§7.10).
 * Itera tenants con propiedades listadas (googleHotelData.isListed), excluye ítems incompletos
 * y valida XML (well-formed + XSD opcional vía xmllint).
 *
 * Identidad Property.id: **id de propiedad en PostgreSQL** (`propiedades.id`) — estable y alineado
 * con deep links `/propiedad/:id` y con el ARI global cuando `partnerXmlIdsFromDatabase` está activo.
 */
const crypto = require('crypto');
const pool = require('../db/postgres');
const { generateAriFeed } = require('./googleHotelsService');
const { buildPublicBookingBaseUrl, extractOfficialSiteContact } = require('./googleHotelsPartner/publicBookingUrl');
const { resolveFeedPrimaryImageUrl } = require('./googleHotelsPartner/feedImageUrl');
const { buildPropertyListItemXml } = require('./googleHotelsPartner/feedPropertyListBlock');
const { assertPartnerFeedXml } = require('./googleHotelsPartner/feedXmlWellformed');
const { resolveEffectiveGoogleHotelsAddress } = require('./googleHotelsEmpresaAddress');
const { extractLatLng } = require('./googleHotelsPartner/propertyFeedGeo');

function _safeObj(v) {
    return v && typeof v === 'object' ? v : {};
}

const escapeXml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

function extractTransactionInner(xml) {
    const m = String(xml).match(/<Transaction[^>]*>([\s\S]*)<\/Transaction>/i);
    return m ? m[1].trim() : '';
}

function partnerRatePlanId() {
    return String(process.env.GOOGLE_PARTNER_RATE_PLAN_ID || 'sm_direct_lowest').trim() || 'sm_direct_lowest';
}

/** Id único por generación del XML (recomendación Google para `<Transaction id>`). */
function uniqueTransactionFeedId(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

/** Decimal con punto (JavaScript ya usa `.`; evita sorpresas si se formatea número como string). */
function formatDecimalCoord(n) {
    if (n == null || !Number.isFinite(Number(n))) return '0';
    return String(Number(n));
}

/** `<category>` Hotel List: hotel vs alojamiento tipo vacacional (cabins etc.). */
function partnerPropertyCategoryFromEmpresa(empresaConfig) {
    const t = String(_safeObj(empresaConfig).tipoNegocio || 'complejo').toLowerCase();
    if (t === 'hotel') return 'hotel';
    return 'vacation_rental';
}

/** §7.5: con `GOOGLE_PARTNER_REQUIRE_PLACE_ID=1` se exige `googleHotelData.placeId` además de lat/lng. */
function isPlaceIdRequiredForGlobalFeed() {
    return String(process.env.GOOGLE_PARTNER_REQUIRE_PLACE_ID || '0').trim() === '1';
}

function extractPlaceId(gh) {
    const raw = gh.placeId ?? gh.place_id ?? gh.google_place_id;
    const s = raw != null ? String(raw).trim() : '';
    return s || null;
}

async function fetchListedPropertyRows() {
    const { rows } = await pool.query(
        `SELECT p.id, p.nombre, p.metadata, p.num_piezas, p.empresa_id,
                e.subdominio, e.configuracion AS empresa_configuracion
         FROM propiedades p
         JOIN empresas e ON e.id = p.empresa_id
         WHERE p.activo = true
           AND (p.metadata->'googleHotelData'->>'isListed')::boolean = true
           AND COALESCE(p.metadata->'googleHotelData'->>'hotelId','') <> ''
         ORDER BY e.subdominio NULLS LAST, p.nombre`
    );
    return rows;
}

/**
 * Resuelve elegibilidad para el feed global. Registra causas en `skipped`.
 * Requiere: hotelId, lat+lng, base URL pública, y (salvo env) google_place_id.
 */
function resolvePartnerListing(row, skipped) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const gh = meta.googleHotelData && typeof meta.googleHotelData === 'object' ? meta.googleHotelData : {};
    const hotelId = String(gh.hotelId || '').trim();
    if (!hotelId) {
        if (skipped) skipped.push({ empresaId: row.empresa_id, propiedadId: row.id, reason: 'missing_hotelId' });
        return null;
    }

    const { lat, lng } = extractLatLng(meta, gh, row.empresa_configuracion);
    if (lat == null || lng == null) {
        if (skipped) skipped.push({ empresaId: row.empresa_id, propiedadId: row.id, reason: 'missing_geo' });
        return null;
    }

    const placeId = extractPlaceId(gh);
    if (isPlaceIdRequiredForGlobalFeed() && !placeId) {
        if (skipped) skipped.push({ empresaId: row.empresa_id, propiedadId: row.id, reason: 'missing_place_id' });
        return null;
    }

    const baseUrl = buildPublicBookingBaseUrl(row.empresa_configuracion);
    if (!baseUrl) {
        if (skipped) skipped.push({ empresaId: row.empresa_id, propiedadId: row.id, reason: 'missing_public_base_url' });
        return null;
    }

    const deepLink = `${baseUrl.replace(/\/$/, '')}/propiedad/${row.id}`;
    const effAddr = resolveEffectiveGoogleHotelsAddress({ googleHotelData: gh }, row.empresa_configuracion);
    if (!effAddr) {
        if (skipped) skipped.push({ empresaId: row.empresa_id, propiedadId: row.id, reason: 'missing_address' });
        return null;
    }
    const ghAddr = _safeObj(gh.address);
    const postalMerged = String(
        effAddr.postalCode || ghAddr.postalCode || ghAddr.postal_code || '',
    ).trim();
    const addr = {
        street: effAddr.street,
        city: effAddr.city,
        locality: effAddr.city,
        countryCode: effAddr.countryCode,
        country: effAddr.countryCode,
        postalCode: postalMerged,
        province: String(effAddr.province || '').trim(),
    };
    const city = String(addr.city || addr.locality || '').trim();
    const { phone, website } = extractOfficialSiteContact(row.empresa_configuracion);
    const category = partnerPropertyCategoryFromEmpresa(row.empresa_configuracion);

    return {
        /** ID estable en BD — usado como XML Property.id en feeds globales §7.9 */
        propertyDbId: String(row.id),
        hotelId,
        nombre: row.nombre || '',
        lat,
        lng,
        placeId,
        deepLink,
        addr,
        city,
        phone,
        website,
        category,
    };
}

/**
 * Primer `storage_url` de galería por par (empresa_id, propiedad_id).
 */
async function fetchGaleriaFirstImageByEmpresaPropiedad(rows) {
    const map = new Map();
    if (!pool || !rows.length) return map;
    const empresaIds = rows.map((r) => String(r.empresa_id));
    const propiedadIds = rows.map((r) => String(r.id));
    try {
        const { rows: gRows } = await pool.query(
            `SELECT DISTINCT ON (g.empresa_id, g.propiedad_id)
                    g.empresa_id, g.propiedad_id, g.storage_url
               FROM galeria g
               INNER JOIN (
                  SELECT TRIM(x) AS x, TRIM(y) AS y
                    FROM UNNEST($1::text[], $2::text[]) AS u(x, y)
               ) v ON g.empresa_id::text = v.x AND g.propiedad_id::text = v.y
              ORDER BY g.empresa_id, g.propiedad_id, g.orden ASC NULLS LAST`,
            [empresaIds, propiedadIds]
        );
        for (const r of gRows) {
            map.set(`${r.empresa_id}::${r.propiedad_id}`, r.storage_url);
        }
    } catch (e) {
        console.warn('[googleHotelsGlobalService] fetchGaleriaFirstImageByEmpresaPropiedad:', e.message);
    }
    return map;
}

/**
 * Catálogo §7.6 — mismos ítems elegibles que el Property List.
 */
async function getPartnerCatalogItems() {
    if (!pool) {
        return { items: [], skipped: [], postgresRequired: true };
    }
    const rows = await fetchListedPropertyRows();
    const skipped = [];
    const items = [];
    const galeriaMap = await fetchGaleriaFirstImageByEmpresaPropiedad(rows);
    for (const row of rows) {
        const core = resolvePartnerListing(row, skipped);
        if (!core) continue;
        const galUrl = galeriaMap.get(`${row.empresa_id}::${row.id}`);
        const fotoUrl = resolveFeedPrimaryImageUrl(row, galUrl);
        items.push({
            propertyId: core.propertyDbId,
            hotelId: core.hotelId,
            title: core.nombre,
            deepLink: core.deepLink,
            fotoUrl,
            city: core.city,
        });
    }
    items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' }));
    return { items, skipped, postgresRequired: false };
}

/**
 * @returns {{ xml: string, skipped: Array<{empresaId:string,propiedadId:string,reason:string}> }}
 */
async function generateGlobalPropertyListXml(_db) {
    if (!pool) {
        throw new Error('POSTGRES_REQUIRED');
    }
    const rows = await fetchListedPropertyRows();
    const skipped = [];
    const parts = [];
    const galeriaMap = await fetchGaleriaFirstImageByEmpresaPropiedad(rows);
    for (const row of rows) {
        try {
            const core = resolvePartnerListing(row, skipped);
            if (!core) continue;
            const galUrl = galeriaMap.get(`${row.empresa_id}::${row.id}`);
            const fotoUrl = resolveFeedPrimaryImageUrl(row, galUrl);
            const frag = buildPropertyListItemXml({
                xmlPropertyId: core.propertyDbId,
                nombre: core.nombre,
                addr: {
                    street: core.addr.street,
                    city: core.addr.city,
                    locality: core.addr.locality,
                    province: core.addr.province,
                    postalCode: core.addr.postalCode,
                    countryCode: core.addr.countryCode,
                },
                category: core.category,
                lat: core.lat,
                lng: core.lng,
                phone: core.phone,
                website: core.website,
                fotoUrl,
                deepLink: core.deepLink,
                formatDecimalCoord,
            });
            parts.push(frag);
        } catch (e) {
            skipped.push({
                empresaId: row.empresa_id,
                propiedadId: row.id,
                reason: `exception:${e.message}`,
            });
        }
    }

    const inner = parts.join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<Transaction timestamp="${new Date().toISOString()}" id="${escapeXml(uniqueTransactionFeedId('partner-global-properties'))}">\n`
        + `  <Result>\n`
        + inner
        + `  </Result>\n`
        + `</Transaction>\n`;

    assertPartnerFeedXml(xml, 'partner-property-list');
    return { xml, skipped };
}

async function fetchEligiblePropertyIdsForAri() {
    const rows = await fetchListedPropertyRows();
    const skipped = [];
    const ids = new Set();
    for (const row of rows) {
        const core = resolvePartnerListing(row, skipped);
        if (core) ids.add(String(row.id));
    }
    return { ids, skipped };
}

/**
 * @returns {{ xml: string, skipped: Array<{empresaId:string,reason:string}>, propertySkipLog: Array<{empresaId:string,propiedadId:string,reason:string}> }}
 */
async function generateGlobalAriXml(db) {
    if (!pool) {
        throw new Error('POSTGRES_REQUIRED');
    }
    const { ids: eligibleIds, skipped: propertySkips } = await fetchEligiblePropertyIdsForAri();

    const empresaIds = [...new Set(
        (await pool.query(
            `SELECT DISTINCT p.empresa_id AS id
               FROM propiedades p
               WHERE p.activo = true
                 AND (p.metadata->'googleHotelData'->>'isListed')::boolean = true
                 AND COALESCE(p.metadata->'googleHotelData'->>'hotelId','') <> ''`
        )).rows.map((r) => r.id),
    )];

    const skipped = [];
    const innerBlocks = [];
    const opts = {
        mode: 'google_hotels',
        days: Math.min(365, Math.max(14, Number(process.env.GOOGLE_PARTNER_ARI_DAYS) || 180)),
        partnerAllInclusive: true,
        ratePlanId: partnerRatePlanId(),
        partnerXmlIdsFromDatabase: true,
        restrictToPropertyIds: eligibleIds,
    };

    for (const empresaId of empresaIds) {
        try {
            const chunk = await generateAriFeed(db, empresaId, opts);
            const inner = extractTransactionInner(chunk);
            if (inner) innerBlocks.push(inner);
        } catch (e) {
            skipped.push({ empresaId, reason: e.message || String(e) });
            console.error('[googleHotelsGlobalService] ARI skip empresa', empresaId, e.message);
        }
    }

    const body = innerBlocks.length ? innerBlocks.join('\n') : '  <Result/>';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<Transaction timestamp="${new Date().toISOString()}" id="${escapeXml(uniqueTransactionFeedId('partner-global-ari'))}">\n`
        + body
        + `\n</Transaction>\n`;

    assertPartnerFeedXml(xml, 'partner-global-ari');
    return { xml, skipped, propertySkipLog: propertySkips };
}

/**
 * Resumen de exclusiones del feed global por empresa (health / §7.5).
 */
async function auditPartnerListingGapsForEmpresa(empresaId) {
    if (!pool) {
        return { postgresRequired: true, skipped: [], totalListedHotelId: 0, eligibleForGlobalFeed: 0 };
    }
    const { rows } = await pool.query(
        `SELECT p.id, p.nombre, p.metadata, p.num_piezas, p.empresa_id,
                e.configuracion AS empresa_configuracion
           FROM propiedades p
           JOIN empresas e ON e.id = p.empresa_id
          WHERE p.empresa_id = $1
            AND p.activo = true
            AND (p.metadata->'googleHotelData'->>'isListed')::boolean = true
            AND COALESCE(p.metadata->'googleHotelData'->>'hotelId','') <> ''`,
        [empresaId]
    );
    const skipped = [];
    let eligible = 0;
    for (const row of rows) {
        const core = resolvePartnerListing(row, skipped);
        if (core) eligible += 1;
    }
    const skippedByReason = skipped.reduce((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
    }, {});
    return {
        postgresRequired: false,
        totalListedHotelId: rows.length,
        eligibleForGlobalFeed: eligible,
        skipped,
        skippedByReason,
    };
}

module.exports = {
    generateGlobalPropertyListXml,
    generateGlobalAriXml,
    getPartnerCatalogItems,
    resolvePartnerListing,
    fetchListedPropertyRows,
    auditPartnerListingGapsForEmpresa,
};
