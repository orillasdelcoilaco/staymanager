/**
 * Feed global único para Google Hotels Connectivity Partner (TASKS/venta-ia.md §7.9–§7.10).
 * Itera tenants con propiedades listadas (googleHotelData.isListed), excluye ítems incompletos
 * y valida XML (well-formed + XSD opcional vía xmllint).
 *
 * Identidad Property.id: **id de propiedad en PostgreSQL** (`propiedades.id`) — estable y alineado
 * con deep links `/propiedad/:id` y con el ARI global cuando `partnerXmlIdsFromDatabase` está activo.
 */
const pool = require('../db/postgres');
const { generateAriFeed } = require('./googleHotelsService');
const { buildPublicBookingBaseUrl } = require('./googleHotelsPartner/publicBookingUrl');
const { assertPartnerFeedXml } = require('./googleHotelsPartner/feedXmlWellformed');

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

/** §7.5: con `GOOGLE_PARTNER_REQUIRE_PLACE_ID=1` se exige `googleHotelData.placeId` además de lat/lng. */
function isPlaceIdRequiredForGlobalFeed() {
    return String(process.env.GOOGLE_PARTNER_REQUIRE_PLACE_ID || '0').trim() === '1';
}

function extractPlaceId(gh) {
    const raw = gh.placeId ?? gh.place_id ?? gh.google_place_id;
    const s = raw != null ? String(raw).trim() : '';
    return s || null;
}

function extractLatLng(meta, gh) {
    const ubi = meta.ubicacion && typeof meta.ubicacion === 'object' ? meta.ubicacion : {};
    const g = gh.geo && typeof gh.geo === 'object' ? gh.geo : {};
    const latRaw = g.lat != null ? g.lat : (gh.latitude != null ? gh.latitude : ubi.lat);
    const lngRaw = g.lng != null ? g.lng : (gh.longitude != null ? gh.longitude : ubi.lng ?? ubi.lon);
    const lat = latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null;
    const lng = lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null;
    return { lat, lng };
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

    const { lat, lng } = extractLatLng(meta, gh);
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
    const addr = gh.address && typeof gh.address === 'object' ? gh.address : {};
    const fotoUrl = meta.linkFotos ? String(meta.linkFotos) : null;
    const city = String(addr.city || addr.locality || '').trim();

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
        fotoUrl,
        city,
    };
}

function buildOnePropertyBlock(row, skipped) {
    const core = resolvePartnerListing(row, skipped);
    if (!core) return '';

    const xmlId = escapeXml(core.propertyDbId);
    const { nombre, lat, lng, deepLink, addr, fotoUrl } = core;

    let body = `    <Property id="${xmlId}">\n`;
    body += `      <Name>${escapeXml(nombre)}</Name>\n`;
    body += `      <Address>\n`;
    body += `        <addr1>${escapeXml(String(addr.street || ''))}</addr1>\n`;
    body += `        <city>${escapeXml(String(addr.city || addr.locality || ''))}</city>\n`;
    if (addr.postalCode || addr.postal_code) {
        body += `        <postal_code>${escapeXml(String(addr.postalCode || addr.postal_code || ''))}</postal_code>\n`;
    }
    body += `        <country>${escapeXml(String(addr.countryCode || addr.country || ''))}</country>\n`;
    body += `      </Address>\n`;
    body += `      <Latitude>${lat}</Latitude>\n`;
    body += `      <Longitude>${lng}</Longitude>\n`;
    if (fotoUrl) {
        body += `      <Photo URL="${escapeXml(fotoUrl)}"/>\n`;
    }
    body += `      <DeepLink>${escapeXml(deepLink)}</DeepLink>\n`;
    body += `    </Property>\n`;
    return body;
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
    for (const row of rows) {
        const core = resolvePartnerListing(row, skipped);
        if (!core) continue;
        items.push({
            propertyId: core.propertyDbId,
            hotelId: core.hotelId,
            title: core.nombre,
            deepLink: core.deepLink,
            fotoUrl: core.fotoUrl,
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
    for (const row of rows) {
        try {
            const frag = buildOnePropertyBlock(row, skipped);
            if (frag) parts.push(frag);
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
        + `<Transaction timestamp="${new Date().toISOString()}" id="partner-global-properties">\n`
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
        + `<Transaction timestamp="${new Date().toISOString()}" id="partner-global-ari">\n`
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
