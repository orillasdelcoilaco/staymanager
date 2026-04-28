const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { generateAriFeed, generatePropertyListFeed } = require('./googleHotelsService');
const pool = require('../db/postgres');

function _safeObj(v) {
    return v && typeof v === 'object' ? v : {};
}

function _hasText(v) {
    return String(v || '').trim().length > 0;
}

function _buildPublicBaseUrl(cfg) {
    const ws = _safeObj(cfg.websiteSettings);
    const general = _safeObj(ws.general);
    const domain = String(general.domain || ws.domain || '').trim().toLowerCase();
    const sub = String(general.subdomain || ws.subdomain || '').trim().toLowerCase();
    if (domain && !domain.endsWith('.local')) return `https://${domain}`;
    if (sub) return `https://${sub}.${process.env.PLATFORM_DOMAIN || 'suitemanagers.com'}`;
    return null;
}

function _validateJsonLdStrict(jsonLd) {
    const j = _safeObj(jsonLd);
    const address = _safeObj(j.address);
    const geo = _safeObj(j.geo);
    const errors = [];
    if (!_hasText(j['@context'])) errors.push('jsonld.@context faltante');
    if (!j['@type']) errors.push('jsonld.@type faltante');
    if (!_hasText(j.name)) errors.push('jsonld.name faltante');
    if (!_hasText(address.addressLocality)) errors.push('jsonld.address.addressLocality faltante');
    if (!_hasText(address.addressCountry)) errors.push('jsonld.address.addressCountry faltante');
    if (!(_hasText(geo.latitude) || _hasText(geo.longitude) || (_hasText(address.streetAddress) && _hasText(address.addressLocality)))) {
        errors.push('jsonld sin geo (lat/lng) ni dirección suficiente');
    }
    return { ok: errors.length === 0, errors };
}

async function auditGoogleHotelsJsonLdStrict(empresaId) {
    const propiedades = await obtenerPropiedadesPorEmpresa(null, empresaId);
    const listed = propiedades.filter((p) => p?.googleHotelData?.isListed === true);
    const report = listed.map((p) => {
        const jsonLd = p?.buildContext?.publicacion?.jsonLd
            || p?.metadata?.buildContext?.publicacion?.jsonLd
            || null;
        const v = _validateJsonLdStrict(jsonLd);
        return {
            propiedadId: p.id,
            nombre: p.nombre || '',
            ok: v.ok,
            errores: v.errors,
        };
    });
    return {
        empresaId,
        totalListadas: listed.length,
        ok: report.every((r) => r.ok),
        items: report,
    };
}

async function evaluateGoogleHotelsHealth(empresaId) {
    if (!pool) {
        return { ok: false, semaforo: 'red', error: 'POSTGRES_REQUIRED' };
    }
    const { rows } = await pool.query('SELECT configuracion FROM empresas WHERE id = $1 LIMIT 1', [empresaId]);
    const cfg = _safeObj(rows[0]?.configuracion);
    const baseUrl = _buildPublicBaseUrl(cfg);

    const propiedades = await obtenerPropiedadesPorEmpresa(null, empresaId);
    const listed = propiedades.filter((p) => p?.googleHotelData?.isListed === true);
    const missingHotelId = listed.filter((p) => !_hasText(p?.googleHotelData?.hotelId)).length;
    const missingAddress = listed.filter((p) => {
        const a = _safeObj(p?.googleHotelData?.address);
        return !_hasText(a.street) || !_hasText(a.city) || !_hasText(a.countryCode);
    }).length;

    const xmlContent = await generatePropertyListFeed(null, empresaId);
    const xmlAri = await generateAriFeed(null, empresaId, { mode: 'google_hotels', days: 30 });
    const feedChecks = {
        contentXmlOk: /<Transaction[\s>]/i.test(xmlContent) && /<Result[\s>]/i.test(xmlContent),
        ariXmlOk: /<Transaction[\s>]/i.test(xmlAri) && /<Result[\s>]/i.test(xmlAri),
    };

    const jsonLdAudit = await auditGoogleHotelsJsonLdStrict(empresaId);
    const totalIssues =
        (listed.length === 0 ? 1 : 0)
        + missingHotelId
        + missingAddress
        + (feedChecks.contentXmlOk ? 0 : 1)
        + (feedChecks.ariXmlOk ? 0 : 1)
        + (jsonLdAudit.ok ? 0 : 1);

    let semaforo = 'green';
    if (totalIssues >= 3) semaforo = 'red';
    else if (totalIssues > 0) semaforo = 'yellow';

    return {
        ok: semaforo !== 'red',
        semaforo,
        empresaId,
        baseUrl,
        feeds: {
            ari: baseUrl ? `${baseUrl}/feed-ari.xml?mode=google_hotels&days=180` : null,
            content: baseUrl ? `${baseUrl}/feed-google-hotels-content.xml` : null,
        },
        inventario: {
            total: propiedades.length,
            listadas: listed.length,
            missingHotelId,
            missingAddress,
        },
        feedChecks,
        jsonLdStrict: {
            ok: jsonLdAudit.ok,
            totalListadas: jsonLdAudit.totalListadas,
            errores: jsonLdAudit.items.filter((x) => !x.ok),
        },
    };
}

module.exports = {
    evaluateGoogleHotelsHealth,
    auditGoogleHotelsJsonLdStrict,
};

