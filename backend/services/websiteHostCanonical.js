/**
 * Host canónico del sitio público (§3.3): solo aplica a dominio propio (no subdominio de plataforma).
 */

const PLATFORM_DOMAIN = (process.env.PLATFORM_DOMAIN || 'rezerva.cl').toLowerCase();

function isPlatformHostedHostname(host) {
    const h = String(host || '').toLowerCase().trim();
    if (!h) return true;
    if (h.endsWith('.onrender.com')) return true;
    if (h.endsWith(`.${PLATFORM_DOMAIN}`)) return true;
    const aliases = String(process.env.PLATFORM_DOMAIN_ALIASES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return aliases.some(d => h.endsWith(`.${d}`));
}

function getConfiguredPublicDomain(empresa) {
    if (!empresa) return '';
    const ws = empresa.websiteSettings || {};
    const g = ws.general || {};
    return String(g.domain || ws.domain || empresa.dominio || '').toLowerCase().trim();
}

/**
 * Host canónico para redirección www/apex (solo dominio “propio”).
 * @returns {string|null} hostname en minúsculas o null si no aplica redirección
 */
function getCanonicalCustomHostname(empresa) {
    const dom = getConfiguredPublicDomain(empresa);
    if (!dom || isPlatformHostedHostname(dom)) return null;
    return dom;
}

/**
 * Variante www ↔ apex del mismo FQDN (p. ej. hotel.cl ↔ www.hotel.cl).
 * @param {string} hostLower
 * @returns {string|null}
 */
function wwwApexAlternate(hostLower) {
    const h = String(hostLower || '').toLowerCase().trim();
    if (!h || !h.includes('.')) return null;
    if (h.startsWith('www.')) return h.slice(4) || null;
    return `www.${h}`;
}

module.exports = {
    PLATFORM_DOMAIN,
    isPlatformHostedHostname,
    getConfiguredPublicDomain,
    getCanonicalCustomHostname,
    wwwApexAlternate,
};
