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

/**
 * Teléfono y sitio oficial del tenant (feed Google / entity matching).
 * Orden: contacto web → WhatsApp en general → telefono legacy en raíz de configuración.
 */
function extractOfficialSiteContact(empresaConfiguracion) {
    const cfg = empresaConfiguracion && typeof empresaConfiguracion === 'object' ? empresaConfiguracion : {};
    const ws = cfg.websiteSettings && typeof cfg.websiteSettings === 'object' ? cfg.websiteSettings : {};
    const contact = ws.contact && typeof ws.contact === 'object' ? ws.contact : {};
    const general = ws.general && typeof ws.general === 'object' ? ws.general : {};
    const phone = String(
        contact.telefonoPrincipal || general.whatsapp || cfg.telefono || ''
    ).trim();
    const website = buildPublicBookingBaseUrl(cfg) || '';
    return { phone, website };
}

module.exports = { buildPublicBookingBaseUrl, extractOfficialSiteContact };
