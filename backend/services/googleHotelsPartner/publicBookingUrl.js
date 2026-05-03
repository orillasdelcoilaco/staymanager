/**
 * URL pública del sitio SSR del tenant (deep link base para feeds partner).
 * Copia la lógica de googleHotelsHealthService._buildPublicBaseUrl para evitar dependencias circulares.
 */
function buildPublicBookingBaseUrl(empresaConfiguracion) {
    const cfg = empresaConfiguracion && typeof empresaConfiguracion === 'object' ? empresaConfiguracion : {};
    const ws = cfg.websiteSettings && typeof cfg.websiteSettings === 'object' ? cfg.websiteSettings : {};
    const general = ws.general && typeof ws.general === 'object' ? ws.general : {};
    const domain = String(general.domain || ws.domain || '').trim().toLowerCase();
    const sub = String(general.subdomain || ws.subdomain || '').trim().toLowerCase();
    const platform = process.env.PLATFORM_DOMAIN || 'suitemanagers.com';
    if (domain && !domain.endsWith('.local')) return `https://${domain}`;
    if (sub) return `https://${sub}.${platform}`;
    return null;
}

module.exports = { buildPublicBookingBaseUrl };
